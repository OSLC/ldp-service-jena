/*
 * Copyright 2014 IBM Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/*
 * storage.js implements the abstract ldp-service/storage.js module by
 * storing RDF graphs in Apache Jena. Each document representations
 * an RDF graph. Documents have the properties below. The 'triples'
 * property is the RDF. Other properties are metadata.
 *
 * This implementation delegates all the database requests to Fuesiki 
 * using the JenaURL from the env parameter
 *
 * All documents:
 *
 *   name - the URI of the graph
 *   interactionModel - the URI indicating the LDP interaction model of the resource
 *   container - the container for this resource
 *   deleted - boolean indicating if the resource has been deleted (to avoid reusing URIs)
 *   triples - an array of RDF triples in N3.js format
 *
 * Direct containers:
 *
 *   membershipResource - the ldp:membershipResource property
 *   hasMemberRelation - the ldp:hasMemberRelation property
 *   isMemberOfRelation - the ldp:isMemberOfRelation property
 *
 * Membership resources (resources in a container):
 *
 *   membershipResourceFor - the associated direct container (always 1:1)
 *
 * Rather than storing a link to all of its members in the container,
 * we have a property in each resource that points back to its
 * container. On a container GET, we query for a container's resources
 * and mix in containment triples.
 */

module.exports = (function(storage_services) {

var ldp = require('./vocab/ldp.js') // LDP vocabulary
var rdflib = require('rdflib')
var request = require('request')
var db

storage_services.init = function(env, callback) {
	db = env.jenaURL
	callback()
}

storage_services.reserveURI = function(uri, callback) {
	// simply create a document with only a URI. we will 
	// just update it later on put
	// if it fails, we reject the uri
	var options = {
        uri: db+"data?graph="+uri.toLowerCase(),
        method: "PUT",
        headers: {
        	'Content-Type': 'application/ld+json'
        },
        body: null
    }   
    request(options, function(err, ires, body) {
    	callback(err, ires)
    })
}

storage_services.releaseURI = function(uri) {
	var options = {
        uri: db+"data?graph="+uri.toLowerCase(),
        method: "DELETE",
    }
    request(options, function(err, ires, body){
        if (err) ires.send(500)
    })
}

storage_services.read = function(uri, callback) {
    var options = {
        uri: db+"data?graph="+uri.toLowerCase(),
        method: "GET",
        headers: {
            "Accept": "text/turtle"
        }          
    }
    request(options, function(err, ires, body) {
        if (err || ires.statusCode !== 200) {
            callback(err)
            return
        }
        // parse the response for the KB
        err = null
        kb = new rdflib.IndexedFormula()
        rdflib.parse(body, kb, uri, 'text/turtle', function(err, kb) {
            callback(err, kb)
        }) 
    })
}

storage_services.update = function(resource, callback) {
    var doc = rdflib.serialize
	var options = {
        uri: db+"data?graph="+uri.toLowerCase(),
        method: "PUT",
        headers: {
         	'Content-Type': content_type
        },
        body: doc
    }
    request(options, function(err, ires, body) {
    	callback(err, ires);
    })
}

storage_services.remove = function(uri, callback) {
	var options = {
        uri: db+"update?graph="+uri.toLowerCase(),
        method: "DELETE",
    }
    request(options, function(err, ires, body) {
        callback(err, ires);
    })
}

storage_services.findContainer = function(uri, callback) {
	throw "storage method fincContainer(uri, callback) not implemented"
}

/* Get the membership triples for a DirectContainer */
storage_services.getContainment = function(container, callback) {
    var options = {
        uri: db+"sparql",
        method: "POST",
        headers: {
            "Content-Type": "application/sparql-query",
            "Accept": "application/sparql-results+json"
        },
        body: "SELECT ?member FROM <"+container.membershipResource+"> WHERE {<"+container.membershipResource+"> <"+container.hasMemberRelation+"> ?member .}"          
    }
    request(options, function(err, ires, body) {
        if (err || ires.statusCode !== 200) {
            callback(err)
            return
        }
        callback(err, JSON.parse(body).results.bindings)
    })
}

storage_services.createMembershipResource = function(document, callback) {
	throw "storage method createMembershipResource(document, callback) not implemented"
}

storage_services.drop = function(callback) {
}


exports.query = function(ast, base, callback) {
	// convert OSLC query to SPARQL and execute
    var node = ast
    var stack = new Array()
    var var_stack = new Array()

    if (node.right.val === "*") { 
        var uri = "SELECT ?g WHERE {GRAPH ?g { ?s ?p ?o } }"
        var options = {
            uri: db+"query?query="+uri,
            method: "GET",
            headers: {
                "Accept": "application/sparql-results+json"
            }               
        }

        request(options, function(err, ires, body) {
            console.log("REQUEST " + options.uri)
            callback(err, ires);
        })
    } else {
        var sparql_query_select = "SELECT ?g ";
        var sparql_query_where = "WHERE { GRAPH ?g { ";
        var sparql_query_prefix = "";
        var sparql_query_orderBy = "";

        var found =  {
            "oslc.select": false,
            "oslc.where": false,
            "oslc.orderBy": false,
            "oslc.prefix": false
        }

        while (node.left != null && node.right != null) {
            while(node.left != null){
                stack.push(node)
                node = node.left
            }

            if (node.val === "oslc.select") {
                found["oslc.where"] = false
                found["oslc.orderBy"] = false
                found["oslc.prefix"] = false
                found["oslc.select"] = true
                var_stack.push("?s")
                node = node.pop().right
            } else if(node.val === "oslc.where") {
                found["oslc.select"] = false
                found["oslc.orderBy"] = false
                found["oslc.prefix"] = false
                found["oslc.where"] = true
                node = stack.pop().right
            } else if(node.val === "oslc.prefix") {
                found["oslc.select"] = false
                found["oslc.orderBy"] = false
                found["oslc.where"] = false
                found["oslc.prefix"] = true
                node = stack.pop().right
            } else if(node.val === "oslc.orderBy") {
                found["oslc.select"] = false
                found["oslc.where"] = false
                found["oslc.prefix"] = false
                found["oslc.orderBy"] = true
                node = stack.pop().right
            } else if(node.val === "oslc.searchTerms") {
                found["oslc.searchTerms"] = true
            } else {
                if (found["oslc.prefix"]){
                    sparql_query_prefix+="PREFIX "+node.val+": "
                    node = stack.pop().right
                    sparql_query_prefix+=node.val+" "
                    node = stack.pop().right
                }
                if (found["oslc.orderBy"]) {
                    if (node.val.charAt(0) === '-') {
                        sparql_query_orderBy += "DESC(?"+node.val.substring(1, node.val.length).replace(':','_') + ") "
                    } else if(node.val.charAt(0) === '+') {
                        sparql_query_orderBy += "ASC(?"+node.val.substring(1, node.val.length).replace(':','_') + ") "
                    } else {
                        sparql_orderBy += "?"+query.substring(index, i).replace(':','_')+" "
                    }
                    node = stack.pop().right
                }

                if (found["oslc.select"]) {
                    sparql_query_select += "?"+node.val.replace(':','_')+" "
                    sparql_query_where += var_stack[stack.length-1]+ " " + node.val + " ?" + node.val.replace(':', '_') + " . "
                    var new_var = node.val.replace(':','_')
                    node = stack.pop()

                    /*
                        if (node.val === '{') {
                            var_stack.push(new_var)
                        }

                        if (node.val === '}') {
                            if (var_stack[var_stack.length-1] !== "?s") {
                                var_stack.pop()    
                            } else {
                                callback("Syntax Error")
                            }
                        }
                    */

                    node = node.right                    
                }

                if (found["oslc.where"]) {
                    sparql_query_where += "?s " + node.val + " "
                    node = stack.pop()
                    sparql_query_where += node.right.val + " . "

                    // node = stack.pop().right
                    node = node.right

                    // DOES NOT consider filters
                }

            }

        }

        uri = sparql_query_prefix+sparql_query_select+sparql_query_where+sparql_query_orderBy + "} }"

        var options = {
            uri: db+"query?query="+uri,
            method: "GET",
            headers: {
                "Accept": "application/sparql-results+json"
            }              
        }

        request(options, function(err, ires, body) {
            console.log("REQUEST " + options.uri);
            if (err) {
                callback(err)
                return
            }

            var triples = []
            body = JSON.parse(body)
            if (body["results"]["bindings"].length === 0) {
                callback(err, ires);
            } else {
                for (var i = 0; i < JSON.parse(body)["results"]["bindings"].length; i++) {
                    triples.push({"subject": base, "predicate": rdf.resource, "object": body["results"]["bindings"][i]["uri"]})
                }

                jsonld.serialize(triples, function(err, result){
                    ires.body = result
                    callback(err, ires)
                })
            }                       
        })
    }
}
})