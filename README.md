# jena-storage-service

A `StorageService` implementation that persists RDF graphs in [Apache Jena Fuseki](https://jena.apache.org/documentation/fuseki2/). Each resource is stored as a named graph in a Fuseki dataset, accessed through the SPARQL 1.1 Graph Store Protocol and SPARQL query endpoints.

## Prerequisites

- Node.js >= 22.11.0
- Apache Jena Fuseki running with a configured dataset. For example:

```sh
# In-memory (non-persistent):
fuseki-server --mem /ldp

# Persistent with update support:
fuseki-server --update --loc=<path-to-db> /ldp
```

## Build

```sh
npm install
npm run build
```

The TypeScript source in `src/` compiles to `dist/`.

## Configuration

`JenaStorageService` is initialized with a `StorageEnv` object that must include a `jenaURL` property pointing to the Fuseki dataset endpoint. For example:

```json
{
  "jenaURL": "http://localhost:3030/ldp/"
}
```

The URL should include the trailing slash and the dataset name. Fuseki service endpoints (`data`, `sparql`, `update`) are resolved relative to this base URL.

## What It Does

`JenaStorageService` implements the `StorageService` interface from the `storage-service` package, providing:

- **CRUD on named graphs** -- `read`, `update`, `remove`, `reserveURI`, and `releaseURI` use the Fuseki Graph Store Protocol (`data` endpoint) to manage individual RDF graphs identified by URI.
- **Partial graph updates** -- `insertData` and `removeData` issue SPARQL Update requests to add or delete triples within a named graph.
- **SPARQL queries** -- `constructQuery` returns parsed RDF results; `sparqlQuery` returns raw results in a requested media type; `getMembershipTriples` resolves LDP Direct Container membership.
- **Dataset export/import** -- `exportDataset` and `importDataset` support TriG (named graphs) and Turtle (single-graph) serialization for backup and migration.

RDF parsing and serialization are handled by `rdflib`.

## Architecture

This module implements the `StorageService` interface defined in `storage-service`. It is consumed by `ldp-service`, which provides LDP protocol handling as Express middleware. The separation allows `ldp-service` to remain storage-agnostic -- swapping `jena-storage-service` for another `StorageService` implementation changes the persistence backend without affecting the LDP logic.

```
ldp-service  --->  StorageService (interface)  <---  jena-storage-service (this module)
                                                <---  storage-service  (other impls)
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](http://www.apache.org/licenses/LICENSE-2.0) for details.
