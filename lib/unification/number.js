var Atom = require("./atom");

class NumberAtom extends Atom{
  constructor(obj){
    super(obj);

    var value = String(this.name).trim();
    if(/^[+-]?\d+$/.test(value)){
      this.name = BigInt(value).toString();
    } else {
      this.name = parseFloat(value).toString();
    }
  }

  toNumber(){
    return parseFloat(this.name);
  }

  toBigInt(){
    if(/^[+-]?\d+$/.test(this.name)){
      return BigInt(this.name);
    }
    return null;
  }

  isInteger(){
    return this.toBigInt() !== null;
  }
}

module.exports = NumberAtom;
