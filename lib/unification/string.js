var Atom = require("./atom");

class StringAtom extends Atom{
  constructor(obj){
    super(obj);
  }

  removeQuotes(){
    return this.name.substr(1, this.name.length - 2);
  }

}

module.exports = StringAtom;
