'use strict'
const Node = require('./node')

class Statement {
  constructor (subject, predicate, object, graph) {
    this.subject = Node.fromValue(subject)
    this.predicate = Node.fromValue(predicate)
    this.object = Node.fromValue(object)
    this.why = graph  // property currently used by rdflib
  }
  get graph () {
    return this.why
  }
  set graph (g) {
    this.why = g
  }
  equals (other) {
    return other.subject.equals(this.subject) && other.predicate.equals(this.predicate) &&
      other.object.equals(this.object) && other.graph.equals(this.graph)
  }
  substitute (bindings) {
    return new Statement(
      this.subject.substitute(bindings),
      this.predicate.substitute(bindings),
      this.object.substitute(bindings),
      this.why)
  }
  toCanonical () {
    return this.toNT()
  }
  toNT () {
    return [this.subject.toNT(), this.predicate.toNT(),
      this.object.toNT()].join(' ') + ' .'
  }
  toString () {
    return this.toNT()
  }
}

module.exports = Statement
