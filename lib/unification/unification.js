
var Atom = require("./atom");
var Variable = require("./variable");
var Predicate = require("./predicate");
var trs = require("./trs")

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
    return flatten(arr);
  }
  return ret;
}

class SubstitutionSet{
  constructor({collection}){
      this.collection = collection || {};
      this._size = 0;
      this._sizeInvalid = true;
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
    if(this.size() !== otherSet.size()){
      return false;
    }
    for(var i in this.collection){
      if(!this.collection[i].equals(otherSet.collection[i])){
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

    return retSet;
  }

  reunion(set){
    if(set === null){
      return null;
    }
    var list = set.toList();
    var reunioned = new SubstitutionSet({});
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
  if(predicate.deepSearch(variable)){
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

function andUnify(unifiedTerms){
  if(unifiedTerms.length <= 1){
    return unifiedTerms[0];
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

  return unionedSet;
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

function* orUnify(statements){
  for(var i in statements){
    yield andUnify(statements[i]);
  }
}

module.exports = {
  unify:unify,
  andUnify: andUnify,
  SubstitutionSet: SubstitutionSet,
  orUnify: orUnify
}
