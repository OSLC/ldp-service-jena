/*
 * Copyright 2014 IBM Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * storage.ts implements the StorageService interface by
 * storing RDF graphs in Apache Jena/Fuseki. Each document represents
 * an RDF graph.
 *
 * env configuration parameters:
 *   env.jenaURL - the URL of the Fuseki data source
 */

import * as rdflib from 'rdflib';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  type MemberBinding,
  ldp,
} from 'storage-service';

const RDF = rdflib.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const LDP = rdflib.Namespace('http://www.w3.org/ns/ldp#');

/** Promisify rdflib.parse */
function parseRdf(
  body: string,
  graph: rdflib.IndexedFormula,
  baseURI: string,
  contentType: string
): Promise<rdflib.IndexedFormula> {
  return new Promise((resolve, reject) => {
    rdflib.parse(body, graph, baseURI, contentType, (err, kb) => {
      if (err) reject(err);
      else resolve(kb as rdflib.IndexedFormula);
    });
  });
}

/** Promisify rdflib.serialize */
function serializeRdf(
  subject: rdflib.NamedNode,
  graph: rdflib.IndexedFormula,
  base: string,
  contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    rdflib.serialize(subject, graph, base, contentType, (err, content) => {
      if (err) reject(err);
      else resolve(content ?? '');
    });
  });
}

export class JenaStorageService implements StorageService {
  private jenaURL = '';

  async init(env: StorageEnv): Promise<void> {
    this.jenaURL = env.jenaURL as string;
  }

  async reserveURI(uri: string): Promise<number> {
    const res = await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: '{}',
    });
    return res.status;
  }

  async releaseURI(uri: string): Promise<void> {
    await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, { method: 'DELETE' });
  }

  async read(uri: string): Promise<{ status: number; document: LdpDocument | null }> {
    const res = await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, {
      method: 'GET',
      headers: { Accept: 'text/turtle' },
    });
    if (res.status !== 200) return { status: res.status, document: null };

    // Fuseki returns Turtle 1.1 PREFIX syntax; rdflib only handles @prefix
    const body = (await res.text()).replace(/^PREFIX\s+(\S+)\s+(<[^>]+>)/gm, '@prefix $1 $2 .');
    const document = new rdflib.IndexedFormula() as unknown as LdpDocument;
    await parseRdf(body, document, uri, 'text/turtle');

    document.uri = uri;
    const uriSym = document.sym(uri);

    let interactionModel: string | null = null;
    if (document.statementsMatching(uriSym, RDF('type'), LDP('BasicContainer')).length !== 0)
      interactionModel = LDP('BasicContainer').value;
    if (document.statementsMatching(uriSym, RDF('type'), LDP('DirectContainer')).length !== 0)
      interactionModel = LDP('DirectContainer').value;
    document.interactionModel = interactionModel;

    if (document.interactionModel === ldp.DirectContainer) {
      const mr = document.any(uriSym, LDP('membershipResource'));
      if (mr) document.membershipResource = mr.value;
      const hmr = document.any(uriSym, LDP('hasMemberRelation'));
      if (hmr) document.hasMemberRelation = hmr.value;
    }

    return { status: res.status, document };
  }

  async update(resource: LdpDocument): Promise<number> {
    const content = await serializeRdf(
      resource.sym(resource.uri), resource, 'none:', 'text/turtle'
    );
    const res = await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(resource.uri)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: content,
    });
    return res.status;
  }

  async insertData(data: rdflib.IndexedFormula, uri: string): Promise<number> {
    let content = '';
    const statements = data.statementsMatching(undefined, undefined, undefined);
    for (const s of statements) {
      content += `<${s.subject.value}> <${s.predicate.value}> <${s.object.value}>. `;
    }
    content = `INSERT DATA {GRAPH <${uri}> {${content}}}`;

    const res = await fetch(`${this.jenaURL}update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: content,
    });
    return res.status;
  }

  async removeData(data: rdflib.IndexedFormula, uri: string): Promise<number> {
    let content = '';
    const statements = data.statementsMatching(undefined, undefined, undefined);
    for (const s of statements) {
      content += `<${s.subject.value}> <${s.predicate.value}> <${s.object.value}>. `;
    }
    content = `DELETE DATA {GRAPH <${uri}> {${content}}}`;

    const res = await fetch(`${this.jenaURL}update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: content,
    });
    return res.status;
  }

  async remove(uri: string): Promise<number> {
    const res = await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, { method: 'DELETE' });
    return res.status;
  }

  async getMembershipTriples(
    container: LdpDocument
  ): Promise<{ status: number; members: MemberBinding[] | null }> {
    const sparql = `SELECT ?member WHERE {<${container.membershipResource}> <${container.hasMemberRelation}> ?member .}`;
    const res = await fetch(`${this.jenaURL}sparql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'application/sparql-results+json',
      },
      body: sparql,
    });
    if (res.status !== 200) return { status: res.status, members: null };

    const body = await res.json() as { results: { bindings: MemberBinding[] } };
    return { status: res.status, members: body.results.bindings };
  }

  async constructQuery(sparql: string): Promise<{ status: number; results: rdflib.IndexedFormula | null }> {
    const res = await fetch(`${this.jenaURL}sparql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'text/turtle',
      },
      body: sparql,
    });
    if (res.status !== 200) return { status: res.status, results: null };

    const body = (await res.text()).replace(/^PREFIX\s+(\S+)\s+(<[^>]+>)/gm, '@prefix $1 $2 .');
    const results = rdflib.graph();
    await parseRdf(body, results, 'urn:query-results', 'text/turtle');
    return { status: res.status, results };
  }

  async sparqlQuery(sparql: string, accept: string): Promise<{ status: number; contentType: string; body: string }> {
    const res = await fetch(`${this.jenaURL}sparql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: accept,
      },
      body: sparql,
    });
    const body = await res.text();
    const contentType = res.headers.get('Content-Type') ?? 'application/sparql-results+json';
    return { status: res.status, contentType, body };
  }

  async exportDataset(format: 'trig' | 'turtle'): Promise<string> {
    const accept = format === 'trig' ? 'application/trig' : 'text/turtle';
    const endpoint = format === 'trig' ? `${this.jenaURL}data` : `${this.jenaURL}data?default`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: accept },
    });
    if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
    return res.text();
  }

  async importDataset(data: string, format: 'trig' | 'turtle'): Promise<void> {
    if (format === 'trig') {
      const res = await fetch(`${this.jenaURL}data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/trig' },
        body: data,
      });
      if (!res.ok) throw new Error(`TriG import failed with status ${res.status}`);
      return;
    }

    // Turtle: parse and load each URI subject's CBD into its own named graph
    const graph = rdflib.graph();
    await parseRdf(data, graph, 'urn:import', 'text/turtle');

    // Group triples by URI subject
    const resourceMap = new Map<string, rdflib.Statement[]>();
    for (const st of graph.statements) {
      if (st.subject.termType !== 'NamedNode') continue;
      const uri = st.subject.value;
      if (!resourceMap.has(uri)) resourceMap.set(uri, []);
      resourceMap.get(uri)!.push(st);
    }

    // Collect blank node triples reachable from each resource (CBD)
    const blankNodeOwnership = new Map<string, string>();
    for (const [uri, stmts] of resourceMap) {
      const queue = stmts
        .filter(st => st.object.termType === 'BlankNode')
        .map(st => st.object.value);
      while (queue.length > 0) {
        const bnId = queue.pop()!;
        if (blankNodeOwnership.has(bnId)) continue;
        blankNodeOwnership.set(bnId, uri);
        for (const st of graph.statementsMatching(rdflib.blankNode(bnId))) {
          if (st.object.termType === 'BlankNode') queue.push(st.object.value);
        }
      }
    }

    // Add blank node triples to their owning resource
    for (const st of graph.statements) {
      if (st.subject.termType !== 'BlankNode') continue;
      const owner = blankNodeOwnership.get(st.subject.value);
      if (owner && resourceMap.has(owner)) {
        resourceMap.get(owner)!.push(st);
      }
    }

    // PUT each resource as a named graph
    for (const [uri, stmts] of resourceMap) {
      const doc = rdflib.graph();
      for (const st of stmts) doc.add(st.subject, st.predicate, st.object, doc.sym(uri));
      const content = await serializeRdf(doc.sym(uri), doc, 'none:', 'text/turtle');
      await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/turtle' },
        body: content,
      });
    }
  }

  async drop(): Promise<void> {
    // No-op for Jena — datasets managed externally
  }
}
