var Atom = require("./atom");

class NumberAtom extends Atom{
  constructor(obj){
    super(obj);
    this.name = parseFloat(this.name).toString();
  }

  toNumber(){
    return parseFloat(this.name);
  }
}

module.exports = NumberAtom;
