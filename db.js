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
 * db.js stores RDF graphs in Apache Jena. Each document representations
 * an RDF graph. Documents have the properties below. The 'triples'
 * property is the RDF. Other properties are metadata.
 *
 */

var ldp = require('./vocab/ldp.js'); // LDP vocabulary
var request = require('request');
var db = "";

exports.init = function(env, callback) {

	db = env.JenaURL;

	callback();
	
};

exports.reserveURI = function(uri, callback) {
	// simply create a document with only a URI. we will just update it later on put
	// if it fails, we reject the uri
	var options = {

            uri: db+"data?graph="+uri.toLowerCase(),
            method: "PUT",
            headers: {
            	'Content-Type': 'application/ld+json'
            },
            body: null
        };

    
    request(options, function(err, ires, body){

    	if(err){
    		callback(err);
    	}

    	callback(err, ires);

    });
};

exports.releaseURI = function(uri) {

	var options = {

        uri: db+"data?graph="+uri.toLowerCase(),
        method: "DELETE",
    };

    request(options, function(err, ires, body){

        if(err){
        	ires.send(500);
            return;
        }

    });

};

exports.put = function(uri, doc, content_type, callback) {
	console.log('db.put');
	
	var options = {

        uri: db+"data?graph="+uri.toLowerCase(),
        method: "PUT",
        headers: {
         	'Content-Type': content_type
        },
        body: doc
    };

    console.log("PUT " + options.uri);

    request(options, function(err, ires, body){

    	if(err){
    		callback(err);
    	}

    	console.log("SUCCESS " + err);

    	callback(err, ires);

    });
	
};

exports.get = function(uri, content_type, callback) {

	console.log('db.get');
    console.log(content_type);

	var options = {

	    uri: db+"data?graph="+uri.toLowerCase(),
	    method: "GET",
	    headers: {
	    	"Accept": content_type
	    }
	       
	};

    request(options, function(err, ires, body){
        console.log("REQUEST " + options.uri);
        if(err){
            callback(err);
        }

        console.log(body);
        console.log("REQUEST SUCCESS");
        callback(err, ires);

    });

};

// LDP layer, shouldn't know the OSLC syntax?

exports.query = function(ast, callback) {

    console.log('db.query');

    console.log("Converting to SPARQL");

    var node = ast;
    var stack = new Array();
    var var_stack = new Array();

    if(node.right.val === "*"){

        var uri = "SELECT ?g WHERE {GRAPH ?g { ?s ?p ?o } }"

        var options = {

            uri: db+"query?query="+uri,
            method: "GET",
            headers: {
                "Accept": "application/sparql-results+json"
            }
               
        };

        request(options, function(err, ires, body){
            console.log("REQUEST " + options.uri);
            if(err){
                callback(err);
            }

            console.log(body);
            console.log("REQUEST SUCCESS");
            callback(err, ires);

        });


    }else{

        var sparql_query_select = "SELECT ?g ";
        var sparql_query_where = "WHERE { GRAPH ?g { ";
        var sparql_query_prefix = "";
        var sparql_query_orderBy = "";

        var found = 
            {
                "oslc.select": false,
                "oslc.where": false,
                "oslc.orderBy": false,
                "oslc.prefix": false
            };

        while(node != null){

            while(node.left != null){

                stack.push(node);
                node = node.left;

            }

            if(node.val === "oslc.select"){

                found["oslc.where"] = false;
                found["oslc.orderBy"] = false;
                found["oslc.prefix"] = false;

                found["oslc.select"] = true;
                var_stack.push("?s");
                node = node.pop().right;

            }else if(node.val === "oslc.where"){

                found["oslc.select"] = false;
                found["oslc.orderBy"] = false;
                found["oslc.prefix"] = false;

                found["oslc.where"] = true;

                node = stack.pop().right;

            }else if(node.val === "oslc.prefix"){

                found["oslc.select"] = false;
                found["oslc.orderBy"] = false;
                found["oslc.where"] = false;

                found["oslc.prefix"] = true;
                node = stack.pop().right;

            }else if(node.val === "oslc.orderBy"){

                found["oslc.select"] = false;
                found["oslc.where"] = false;
                found["oslc.prefix"] = false;

                found["oslc.orderBy"] = true;

                node = stack.pop().right;

            }else if(node.val === "oslc.searchTerms"){

                found["oslc.searchTerms"] = true;

            }else{

                if(found["oslc.prefix"]){
                    sparql_query_prefix+="PREFIX "+node.val+": ";
                    node = stack.pop().right;
                    sparql_query_prefix+=node.val+" ";
                }

                if(found["oslc.orderBy"]){
                    if(node.val.charAt(0) === '-'){
                        sparql_query_orderBy += "DESC(?"+node.val.substring(1, node.val.length).replace(':','_') + ") ";
                    }else if(node.val.charAt(0) === '+'){
                        sparql_query_orderBy += "ASC(?"+node.val.substring(1, node.val.length).replace(':','_') + ") ";
                    }else{
                        sparql_orderBy += "?"+query.substring(index, i).replace(':','_')+" ";
                    }

                    node = stack.pop().right;
                }

                if(found["oslc.select"]){

                    sparql_query_select+="?"+node.val.replace(':','_')+" ";
                    sparql_query_where += var_stack[stack.length-1]+ " " + node.val + " ?" + node.val.replace(':', '_') + " . ";
                    var new_var = node.val.replace(':','_');
                    node = stack.pop();

                    /*
                        if(node.val === '{'){
                            var_stack.push(new_var);
                        }

                        if(node.val === '}'){
                            if(var_stack[var_stack.length-1] !== "?s"){
                                var_stack.pop();    
                            }else{
                                callback("Syntax Error");
                            }
                        }
                    */

                    node = node.right;
                    
                }

                if(found["oslc.where"]){

                    sparql_query_where+="?s " + node.val + " ";
                    node = stack.pop(); // Check if there is a rquired filter
                    sparql_query_where+=node.right.val + " . ";
                    node = stack.pop().right;

                    // DOES NOT consider filters

                }

            }

        }

        uri = sparql_query_prefix+sparql_query_select+sparql_query_where+sparql_query_orderBy;

        var options = {

            uri: db+"query?query="+uri,
            method: "GET",
            headers: {
                "Accept": "application/sparql-results+json"
            }
               
        };

        request(options, function(err, ires, body){
            console.log("REQUEST " + options.uri);
            if(err){
                callback(err);
            }

            console.log(body);
            console.log("REQUEST SUCCESS");
            callback(err, ires);

        });

    }

};

exports.remove = function(uri, callback) {

	var options = {
        uri: db+"update?graph="+uri.toLowerCase(),
        method: "DELETE",
    };

    request(options, function(err, ires, body){

        if(err){
            callback(err);
        }

        callback(err, ires);

    });

};
