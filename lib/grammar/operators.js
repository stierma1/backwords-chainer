var phase2 = require("./phase2");

function isWordChar(ch){
  return /[A-Za-z0-9_]/.test(ch);
}

function escapeRegExp(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unquoteName(name){
  if(name[0] === "'" && name[name.length - 1] === "'"){
    return name.slice(1, -1).replace(/''/g, "'");
  }
  return name;
}

function applyOperatorDirectives(source, operators){
  var directive = /(^|\n)\s*:\-\s*op\s*\(\s*(\d+)\s*,\s*(xfx|xfy|yfx|fx|fy|xf|yf)\s*,\s*([A-Za-z_][A-Za-z0-9_]*|'(?:[^']|'')*')\s*\)\s*\./g;

  source = source.replace(directive, function(match, lineStart, precedence, type, name){
    operators[unquoteName(name)] = {
      precedence:parseInt(precedence, 10),
      type:type
    };
    return lineStart + match.slice(lineStart.length).replace(/[^\n]/g, " ");
  });

  return source;
}

function findOperator(text, operator, type){
  var depth = 0;
  var i = 0;
  var wordOperator = /^[A-Za-z_]/.test(operator);
  var infix = type === "xfx" || type === "xfy" || type === "yfx";

  while(i < text.length){
    if(text[i] === "\"" || text[i] === "'"){
      var quote = text[i];
      i++;
      var escaped = false;
      while(i < text.length){
        if(escaped){
          escaped = false;
        } else if(text[i] === "\\"){
          escaped = true;
        } else if(text[i] === quote){
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    var ch = text[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
    } else if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
    } else if(depth === 0 && text.slice(i, i + operator.length) === operator){
      var before = i === 0 ? "" : text[i - 1];
      var after = text[i + operator.length] || "";

      if(!wordOperator || (!isWordChar(before) && !isWordChar(after))){
        if(infix){
          var left = text.slice(0, i).trim();
          var right = text.slice(i + operator.length).trim();
          if(left && right && right[0] !== "("){
            return i;
          }
        }
      }
    }
    i++;
  }

  return -1;
}

function rewriteSegment(segment, operators, names){
  var trimmed = segment.trim();
  if(!trimmed){
    return segment;
  }

  var leading = segment.slice(0, segment.indexOf(trimmed));
  var trailing = segment.slice(segment.indexOf(trimmed) + trimmed.length);

  for(var i = 0; i < names.length; i++){
    var name = names[i];
    var operator = operators[name];
    var index = findOperator(trimmed, name, operator.type);
    if(index !== -1){
      var left = trimmed.slice(0, index).trim();
      var right = trimmed.slice(index + name.length).trim();
      return leading + name + "(" + rewriteSegment(left, operators, names) + ", " +
        rewriteSegment(right, operators, names) + ")" + trailing;
    }
  }

  return segment;
}

function skipString(source, index){
  var quote = source[index];
  var escaped = false;
  index++;
  while(index < source.length){
    if(escaped){
      escaped = false;
    } else if(source[index] === "\\"){
      escaped = true;
    } else if(source[index] === quote){
      return index + 1;
    }
    index++;
  }
  return index;
}

function findMatchingParen(source, start){
  var depth = 0;
  var i = start;
  while(i < source.length){
    if(source[i] === "\"" || source[i] === "'"){
      i = skipString(source, i);
      continue;
    }
    if(source[i] === "("){
      depth++;
    } else if(source[i] === ")"){
      depth--;
      if(depth === 0){
        return i;
      }
    }
    i++;
  }
  return -1;
}

function rewriteParentheses(source, operators, names){
  var result = "";
  var i = 0;

  while(i < source.length){
    if(source[i] === "\"" || source[i] === "'"){
      var start = i;
      i = skipString(source, i);
      result += source.slice(start, i);
      continue;
    }

    if(source[i] === "("){
      var close = findMatchingParen(source, i);
      if(close === -1){
        result += source.slice(i);
        break;
      }
      result += "(" + rewriteOperators(source.slice(i + 1, close), operators, names) + ")";
      i = close + 1;
      continue;
    }

    result += source[i];
    i++;
  }

  return result;
}

function rewriteOperators(source, operators, names){
  names = names || Object.keys(operators).filter(function(name){
    var type = operators[name].type;
    return type === "xfx" || type === "xfy" || type === "yfx";
  }).sort(function(first, second){
    return operators[second].precedence - operators[first].precedence;
  });

  if(names.length === 0){
    return source;
  }

  source = rewriteParentheses(source, operators, names);

  var parts = phase2.splitTopLevel(source);
  var result = "";

  for(var i = 0; i < parts.length; i++){
    result += rewriteSegment(parts[i].text, operators, names) + parts[i].delimiter;
  }

  return result;
}

module.exports = {
  applyOperatorDirectives: applyOperatorDirectives,
  rewriteOperators: rewriteOperators
};
