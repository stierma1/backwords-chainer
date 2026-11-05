
var Variable = require("./variable");
var Predicate = require("./predicate");

function resolve(term, substitutionSet, seen){
  if(term instanceof Variable){
    if(seen[term.name]){
      return term;
    }
    var replacement = substitutionSet.get(term.name);
    if(replacement === undefined){
      return term;
    }
    seen[term.name] = true;
    var resolved = resolve(replacement, substitutionSet, seen);
    delete seen[term.name];
    return resolved;
  }

  if(term instanceof Predicate){
    var argsList = term.argsList.map((arg) => {
      return resolve(arg, substitutionSet, seen);
    });
    return new term.constructor({name:term.name, argsList:argsList});
  }

  return term;
}

function rewrite(substitutionSet){
  var resolved = {};
  for(var i in substitutionSet.collection){
    resolved[i] = resolve(substitutionSet.collection[i], substitutionSet, {});
  }
  for(var i in resolved){
    substitutionSet.add(i, resolved[i]);
  }

  return substitutionSet;
}

module.exports = rewrite;
