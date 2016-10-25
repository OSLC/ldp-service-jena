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

exports.query = function(uri, content_type, callback) {

    console.log('db.get');
    console.log(content_type);

    var options = {

        uri: db+"query?query="+uri,
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
