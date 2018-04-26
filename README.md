# ldp-service-jena

Provides a concrete implementation of the ldp-service/storage.js abstract storage services module.

ldp-service-jena supports LDP basic and direct containers. Indirect
containers and non-RDF source are not implemented.


Module planning, maintenance and issues can be see at at the [ldp-service](https://hub.jazz.net/project/jamsden/ldp-service/overview) IBM Bluemix DevOps Services project.


## Using

1) Install the required modules

Install [Node.js](http://nodejs.org). 

2) Start [Jena](https://jena.apache.org/download/index.cgi). 

Download apache-jena-fuseki-2.4.1.tar.gz under Apache Jena Fuseki and unzip it.

To run Jena, enter the following code, providing the path to the datastore:

	$ fuseki-server --mem /ldp

/ldp is a datastore that allows the request to access the resources on the db. It can be named in any other way. --mem allows for temporary storage of data
for that instant. For the data to permanently stored, and to update data, the following code should be ran.

	$ fuseki-server --update --loc=<path to db> /ldp

--update allows the user to update resources, while --loc tells the location of the stored items for persistence.

Install express.js and create a sample express app

	$ npm install express -g
	$ express --git -e <appDir>

3) Edit app.js and add whatever Express middleware you need including ldp-service. ldp-service-jena also provides access to its Apache Jena database in case additional middleware needs direct access to the database.

	var ldpService = require('ldp-service');
	var env = require('./env.js');
	app.use(ldpService(env))
	var db = ldpService.db // incase further middleware needs access to the database

4) Configuration should be speciried in env.js. These may be overridden by variables in the environment, including Bluemix variables if deployed in a Bluemix app.

4) To start the app, run these commands

    $ npm install
    $ node app.js

Finally, point your browser to
[http://localhost:3000/](http://localhost:3000/).


## Additional Notes

The file db.js uses the 'request' package from npm to perform HTTP requests on Apache Jena Fuseki. It does not directly connect with the database. Rather, it
finds the location of the Apache Jena db instance using the URI in the configuration.

The code does not have its own resources to upload if there is no root in the database. It loads local 'default services' that are located in the configuration
file. This is a recursive operation at loads all resources with new URI's. It assumes that the default services are written in JSON-LD.


## Example of a env.js File

ldp-service-jena assumes that the environment configuration file provided by applications is written with a certain set of properties. Here is an example.

    {
		"scheme": "http",
		"host": "localhost",
		"port": 3000,
		"context": "/r",
		"JenaURL": "http://localhost:3030/ldp/",
    }


## License

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
