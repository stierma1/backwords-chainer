function stripComments(source){
  var result = "";
  var i = 0;

  while(i < source.length){
    var ch = source[i];

    if(ch === "\"" || ch === "'"){
      var quote = ch;
      result += ch;
      i++;
      var escaped = false;

      while(i < source.length){
        result += source[i];
        if(escaped){
          escaped = false;
        } else if(source[i] === "\\"){
          escaped = true;
        } else if(source[i] === quote){
          if(quote === "'" && source[i + 1] === "'"){
            result += source[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if(ch === "%"){
      while(i < source.length && source[i] !== "\n"){
        i++;
      }
      continue;
    }

    if(ch === "/" && source[i + 1] === "*"){
      i += 2;
      while(i < source.length && !(source[i] === "*" && source[i + 1] === "/")){
        if(source[i] === "\n"){
          result += "\n";
        } else {
          result += " ";
        }
        i++;
      }
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

module.exports = stripComments;
