
var Variable = require("./variable");
var Predicate = require("./predicate");

class Node{
  constructor(term, value){
    this.term = term;
    this.color = 0;
    this.value = value;
    this.inversions = [];
  }
}

function rewrite(substitutionSet){

  var nodes = {};
  for(var i in substitutionSet.collection){
      nodes[i] = new Node(substitutionSet.collection[i], substitutionSet.collection[i]);
  }
  for(var i in nodes){
    if(nodes[i].value instanceof Variable){
      nodes[nodes[i].value.name].inversions.push(nodes[i]);
    }
  }
  for(var i in nodes){
    if(!(nodes[i].value instanceof Variable)){
      for(var j in nodes[i].inversions){
        if(nodes[i].inversions[j].color === 0){
          nodes[i].inversions[j].value = nodes[i].value;
          nodes[i].inversions[j].color = 1;
        }
      }
    }
  }
  for(var i in nodes){
    if(!(nodes[i].value instanceof Predicate)){
      substitutionSet.add(i, nodes[i].value);
    }
  }
  for(var i in nodes){
    if(nodes[i].value instanceof Predicate){
      substitutionSet.add(i, nodes[i].value.deepCopyWithReplace(substitutionSet));
    }
  }

  return substitutionSet;
}

module.exports = rewrite;
