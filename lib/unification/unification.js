
var Atom = require("./atom");
var Variable = require("./variable");
var Predicate = require("./predicate");
var trs = require("./trs")

var occursCheckEnabled = true;

function setOccursCheck(enabled){
  occursCheckEnabled = enabled !== false;
}

function getOccursCheck(){
  return occursCheckEnabled;
}

function zip(arr1, arr2){
  var arr3 = [];
  for(var i = 0; i < arr1.length; i++){
    arr3.push([arr1[i], arr2[i]]);
  }
  return arr3;
}

function flatten(arr){
  var ret = [];
  var flattened = false;
  for(var i of arr){
    if(i instanceof Array){
      ret = ret.concat(i)
      flattened = true;
    } else {
      ret.push(i);
    }
  }
  if(flattened){
    return flatten(ret);
  }
  return ret;
}

class SubstitutionSet{
  constructor({collection, constraints} = {}){
      this.collection = collection || {};
      this.constraints = constraints || [];
      this._size = 0;
      this._sizeInvalid = true;
  }

  addConstraint(left, right){
    this.constraints.push({left:left, right:right});
    return this;
  }

  add(key, ele){
    var trueKey = key.name || key;
    //if(trueKey[0] === "_" && trueKey[1] === "_"){
    //  return this;
    //}
    this._sizeInvalid = true;
    if(ele instanceof Variable){
      //if(ele.name[0] === "_" && ele.name[1] === "_"){
      //  return this;
      //}
      if(ele.name === key || ele.name === key.name ){
        return this;
      }
    }
    this.collection[key.name || key] = ele;
    return this;
  }

  get(key){
    return this.collection[key.name || key];
  }

  equals(otherSet){
    if(!(otherSet instanceof SubstitutionSet)){
      return false;
    }
    if(this.size() !== otherSet.size()){
      return false;
    }
    for(var i in this.collection){
      var other = otherSet.collection[i];
      if(other === undefined){
        return false;
      }
      if(this.collection[i] === other){
        continue;
      }
      if(!this.collection[i] || typeof(this.collection[i].equals) !== "function"){
        return false;
      }
      if(!this.collection[i].equals(other)){
        return false;
      }
    }
    return true;
  }

  toList(){
    var s = [];
    for(var i in this.collection){
      s.push([i, this.collection[i]]);
    }
    return s;
  }

  intersect(set){
    var retSet = new SubstitutionSet({});
    for(var i in this.collection){
      if(set.get(i)){
        retSet.add(i, this.collection[i]);
      }
    }
    retSet.constraints = this.constraints.concat(set.constraints || []);

    return retSet;
  }

  reunion(set){
    if(set === null){
      return null;
    }
    var list = set.toList();
    var reunioned = new SubstitutionSet({});
    reunioned.constraints = this.constraints.concat(set.constraints || []);
    for(var i = 0; i < list.length; i++){
      if(!this.get(list[i][0])){
        reunioned.add(list[i][0], list[i][1]);
      }
    }
    for(var i in this.collection){
      if(!set.get(i)){
        reunioned.add(i, this.collection[i]);
      }
    }
    for(var i = 0; i < list.length; i++){
      if(this.get(list[i][0])){
        if(this.get(list[i][0]) instanceof Atom){
          reunioned.add(list[i][0], this.get(list[i][0]));
        } else if(list[i][1] instanceof Atom) {
          reunioned.add(list[i][0], list[i][1]);
        } else if(this.get(list[i][0]) instanceof Variable){
          reunioned.add(list[i][0], this.get(list[i][0]));
          reunioned.add(this.get(list[i][0]).name, list[i][1]);
        } else{
          reunioned.add(list[i][0], this.get(list[i][0]));
        }
      }
    }

    return reunioned;
  }

  count(){
    var c = 0;
    for(var i in this.collection){
      c++;
    }
    this._size = c;
    this._sizeInvalid = false;
    return c;
  }

  size(){
    if(this._sizeInvalid){
      this.count();
    }
    return this._size;
  }

  toString(){
    var sta = [];
    for(var i in this.collection){
      sta.push(i.toString() + " |-> " + this.collection[i].toString());
    }
    return "{ " + sta.join(", ") + " }"
  }
}

function unify_pred_pred(predicate1, predicate2){
  if(predicate1.name !== predicate2.name){
    return null;
  }
  if(predicate1.arity !== predicate2.arity){
    return null;
  }
  var args = zip(predicate1.argsList, predicate2.argsList);
  var unities = flatten(args.map((arg) => {
    return unify.apply(this, arg);
  }));

  //Check for contradiction
  if(unities.filter((s) => {
    return s === null;
  }).length > 0){
    return null
  }

  return andUnify(unities);
}

function unify_var_pred(variable, predicate){
  //Variables cannot unify with predicates that contain same variable
  if(occursCheckEnabled && predicate.deepSearch(variable)){
    return null;
  }

  return new SubstitutionSet({}).add(variable.name, predicate);
}

function unify_var_var(variable1, variable2){
  var s = new SubstitutionSet({});
  if((variable1.name[0] === "_" && variable1.name[1] === "_") || (variable2.name[0] === "_" && variable2.name[1] === "_")){
    return s;
  }
  s.add((variable1.name), variable2);
  s.add((variable2.name), variable1);
  return s;
}

function unify_var_atom(variable, atom){
  var s = new SubstitutionSet({});
  s.add((variable.name), atom);
  return s;
}

function unify_atom_atom(atom1, atom2){
  if(atom1.equals(atom2)){
    return new SubstitutionSet({});
  }
  return null;
}

function resolveConstraintTerm(term, substitutionSet, path){
  path = path || [];

  if(term instanceof Variable){
    if(path.indexOf(term.name) !== -1){
      var names = path.concat(term.name).sort();
      return new Variable({name:names[0]});
    }

    var replacement = substitutionSet.get(term);
    if(replacement === undefined){
      return term;
    }

    return resolveConstraintTerm(replacement, substitutionSet, path.concat(term.name));
  }

  if(term instanceof Predicate){
    return new term.constructor({
      name:term.name,
      argsList:term.argsList.map(function(arg){
        return resolveConstraintTerm(arg, substitutionSet, path);
      })
    });
  }

  return term;
}

function isGroundTerm(term){
  if(term instanceof Variable){
    return false;
  }
  if(term instanceof Predicate){
    return term.argsList.every(isGroundTerm);
  }
  return true;
}

function termsIdentical(first, second){
  if(first instanceof Variable || second instanceof Variable){
    return first instanceof Variable && second instanceof Variable && first.name === second.name;
  }

  if(first instanceof Predicate || second instanceof Predicate){
    if(!(first instanceof Predicate) || !(second instanceof Predicate)){
      return false;
    }
    if(first.name !== second.name || first.argsList.length !== second.argsList.length){
      return false;
    }
    return first.argsList.every(function(arg, index){
      return termsIdentical(arg, second.argsList[index]);
    });
  }

  if(first instanceof Atom || second instanceof Atom){
    return first instanceof Atom && second instanceof Atom && first.equals(second);
  }

  return false;
}

function enforceConstraints(substitutionSet){
  if(!substitutionSet || !substitutionSet.constraints || substitutionSet.constraints.length === 0){
    return substitutionSet;
  }

  var remaining = [];

  for(var i = 0; i < substitutionSet.constraints.length; i++){
    var constraint = substitutionSet.constraints[i];
    var left = resolveConstraintTerm(constraint.left, substitutionSet, []);
    var right = resolveConstraintTerm(constraint.right, substitutionSet, []);

    if(termsIdentical(left, right)){
      return null;
    }

    var unified = unify(left, right);
    if(unified === null){
      continue;
    }

    if(!isGroundTerm(left) || !isGroundTerm(right)){
      remaining.push(constraint);
    }
  }

  substitutionSet.constraints = remaining;
  return substitutionSet;
}

function andUnify(unifiedTerms){
  if(unifiedTerms.length === 0){
    return new SubstitutionSet({});
  }
  if(unifiedTerms.length === 1){
    return enforceConstraints(unifiedTerms[0]);
  }

  var unionedSet = new SubstitutionSet({});
  for(var i = 0; i < unifiedTerms.length; i++){
    var unifiedTerm = unifiedTerms[i];
    if(unifiedTerm === null){
      return null;
    }
    var intersect = unionedSet.intersect(unifiedTerm);

    if(intersect.size() > 0){
      var interSectList = intersect.toList();
      for(var j = 0; j < interSectList.length; j++){
        var key = interSectList[j][0];
        var unionVal = unionedSet.get(key)
        var unifiedVal = unifiedTerm.get(key);
        var reunion = unify(unionVal, unifiedVal);
        if(reunion === null){
          return null;
        } else if(reunion.size() === 0){

        } else {
          //Inefficient way to prevent circular reference
         var matched = unifiedTerms.filter((term) => {
           return reunion.equals(term)
         });
          if(matched.length === 0){
            unifiedTerms.push(reunion);
          }
        }
      }
    }

    unionedSet = unionedSet.reunion(unifiedTerm);

  }

  return enforceConstraints(unionedSet);
}

function unify(unionVal1, unionVal2){
  if(unionVal1 instanceof Atom){
    if(unionVal2 instanceof Atom){
      return unify_atom_atom(unionVal1,unionVal2);
    } else if(unionVal2 instanceof Variable){
      return unify_var_atom(unionVal2, unionVal1);
    } else {
      return null //atom predicate can never unify
    }
  } else if(unionVal1 instanceof Variable){
    if(unionVal2 instanceof Atom){
      return unify_var_atom(unionVal1,unionVal2);
    } else if(unionVal2 instanceof Variable){
      return unify_var_var(unionVal2, unionVal1);
    } else {
      return unify_var_pred(unionVal1, unionVal2)
    }
  } else {
    if(unionVal2 instanceof Atom){
      return null
    } else if(unionVal2 instanceof Variable){
      return unify_var_pred(unionVal2, unionVal1);
    } else {
      return unify_pred_pred(unionVal1, unionVal2)
    }
  }
}

function unifyWithOccursCheck(unionVal1, unionVal2){
  var previous = occursCheckEnabled;
  occursCheckEnabled = true;
  try{
    return unify(unionVal1, unionVal2);
  } finally {
    occursCheckEnabled = previous;
  }
}

function* orUnify(statements){
  for(var i in statements){
    var unified = andUnify(statements[i]);
    if(unified !== null && unified !== undefined){
      yield unified;
    }
  }
}

module.exports = {
  unify:unify,
  unifyWithOccursCheck: unifyWithOccursCheck,
  andUnify: andUnify,
  SubstitutionSet: SubstitutionSet,
  orUnify: orUnify,
  setOccursCheck: setOccursCheck,
  getOccursCheck: getOccursCheck
}
