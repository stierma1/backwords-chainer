
var Predicate = require("./predicate");
var Atom = require("./atom");

var emptyList = new Atom({name:"[]"});

class List extends Predicate{
  constructor({argsList}){
    super({name:"_list", argsList:argsList});
  }

  static fromArray(listItems){
    if(listItems.length === 0){
      return emptyList;
    }
    var [head, ...tail] = listItems;

    var tailArg = null;

    if(tail.length === 0){
      tailArg = emptyList;
    } else {
      tailArg = List.fromArray(tail);
    }

    return new List({argsList:[head, tailArg]})
  }

  static getEmptyList(){
    return emptyList;
  }
}

module.exports = List;
