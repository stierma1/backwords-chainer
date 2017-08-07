
var Variable = require("./variable");

var runtimeVariableIdx = -1;
function generateRuntimeVariable(){
  runtimeVariableIdx++;
  return new Variable({name:"_G" + runtimeVariableIdx});
}

module.exports = {
  generateRuntimeVariable:generateRuntimeVariable
}
