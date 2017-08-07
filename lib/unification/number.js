var Atom = require("./atom");

class NumberAtom extends Atom{
  constructor(obj){
    super(obj);
  }

  toNumber(){
    return parseFloat(this.name);
  }
}

module.exports = NumberAtom;
