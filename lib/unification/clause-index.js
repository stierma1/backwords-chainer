var Variable = require("./variable");
var Predicate = require("./predicate");

function isGroundTerm(term){
  if(term instanceof Variable){
    return false;
  }
  if(term instanceof Predicate){
    for(var i = 0; i < term.argsList.length; i++){
      if(!isGroundTerm(term.argsList[i])){
        return false;
      }
    }
  }
  return true;
}

function termIndexKey(term){
  if(!term || term instanceof Variable || !isGroundTerm(term)){
    return null;
  }
  return term.constructor.name + ":" + term.toString();
}

function buildIndex(hornClauses, name, arity){
  if(!hornClauses.__index){
    hornClauses.__index = {};
  }
  if(!hornClauses.__index[name]){
    hornClauses.__index[name] = {};
  }
  if(hornClauses.__index[name][arity]){
    return hornClauses.__index[name][arity];
  }

  var index = {
    byFirstArgument:{},
    variableFirstArgument:[]
  };
  var clauses = hornClauses[name] && hornClauses[name][arity];

  if(!clauses){
    hornClauses.__index[name][arity] = index;
    return index;
  }

  for(var i = 0; i < clauses.length; i++){
    var clause = clauses[i];
    var firstArgument = clause.head && clause.head.argsList[0];
    var key = termIndexKey(firstArgument);

    if(key === null){
      index.variableFirstArgument.push({clause:clause, position:i});
    } else {
      index.byFirstArgument[key] = index.byFirstArgument[key] || [];
      index.byFirstArgument[key].push({clause:clause, position:i});
    }
  }

  hornClauses.__index[name][arity] = index;
  return index;
}

function selectClauses(hornClauses, name, arity, firstArgument){
  var clauses = hornClauses[name] && hornClauses[name][arity];
  if(!clauses || clauses.length === 0){
    return clauses || [];
  }

  var key = termIndexKey(firstArgument);
  if(key === null){
    return clauses;
  }

  var index = buildIndex(hornClauses, name, arity);
  var matches = (index.byFirstArgument[key] || []).concat(index.variableFirstArgument);
  matches.sort(function(left, right){
    return left.position - right.position;
  });

  return matches.map(function(entry){
    return entry.clause;
  });
}

function invalidateIndex(hornClauses){
  if(hornClauses){
    hornClauses.__index = null;
  }
}

module.exports = {
  selectClauses:selectClauses,
  invalidateIndex:invalidateIndex,
  termIndexKey:termIndexKey
};
