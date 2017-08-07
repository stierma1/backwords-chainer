/* description: Parses and executes mathematical expressions. */

/* lexical grammar */
%lex
%%
\s+                 return "WHITE_SPACE"
"=("                 return "UNIFY"
"not("               return 'NOT'
"once("               return "ONCE"
"call("               return "CALL"
"apply("              return "APPLY"
"functor("          return "FUNCTOR"
[A-Z][_A-Za-z0-9]*              return 'VARIABLE'
[a-z][_A-Za-z0-9]*               return 'ATOM'
[0-9]               return 'DIGIT'
","                   return ','
";"                   return ';'
"."                   return 'END'
"("                   return '('
")"                   return ')'
":-"                  return ':-'
"!"                   return '!'
"|"                   return "|"
"["                   return "["
"]"                   return "]"
"_"                   return "_"
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex
%left ',' ';' ')'
%left UNION
/* operator associations and precedence */

%start expressions

%% /* language grammar */

expressions
    : clauses opt_white EOF {
      return $1;
    }
    ;

goal
  : statements -> $1
  ;

opt_white
    : /**/ -> ""
    | WHITE_SPACE
    ;

clauses
  : opt_white fact -> [$2]
  | opt_white hornClause -> [$2]
  | clauses opt_white fact {
    $1.push($3);
    $$ = $1;
  }
  | clauses opt_white hornClause {
    $1.push($3);
    $$ = $1;
  }
  ;

fact
  : predicate END {
    $$ = yy.createHornClause($1);
  }
  ;

hornClause
  : predicate opt_white body {
    $$ = yy.createHornClause($1, $3);
  }
  ;

body
  : ":-" statements END {
    $$ = yy.createAndStatements($2);
  }
  ;

statements
  : statement opt_white {
    $$ = yy.createAndStatements($1);
  }
  | statements ";" statement opt_white {
    $$ = yy.createOrStatements($1, $3);
  }
  | statements "," statement opt_white {
    $$ = yy.createAndStatements($1, $3);
  }
  ;

statement
  : opt_white predicate {
    $$ = yy.createPredicateStatement($2)
  }
  | unionStatement -> $1
  | notStatement -> $1
  | onceStatement -> $1
  | applyStatement -> $1
  | callStatement -> $1
  | functorStatement -> $1
  | opt_white "(" statements ")" {
    $$ = $3;
  }
  ;

predicate
  : predicateHead opt_white ")" {
    $$ = yy.createPredicate($1);
  }
  ;

predicateHead
  : atom "(" opt_white atomOrVariableOrPredicateOrList {
      $$ = {name:$1.name, argsList:[$4]}
  }
  | predicateHead opt_white "," opt_white atomOrVariableOrPredicateOrList {
    $1.argsList.push($5);
    $$ = $1;
  }
  ;

notStatement
  : opt_white NOT statements ")" {
    $$ = yy.createNotStatement($3);
  }
  ;

callStatement
  : opt_white CALL opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createCallStatement($4);
  }
  ;

onceStatement
    : opt_white ONCE statements ")" {
      $$ = yy.createOnceStatement($3);
    }
    ;

functorStatement
    : opt_white FUNCTOR opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createFunctorStatement($4, $8, $12);
    }
    ;

applyStatement
    : opt_white APPLY opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createApplyStatement($4, $8);
    }
    ;

unionStatement
  : opt_white UNIFY opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createUnionStatement($4, $8);
  }
  ;

variable
    : VARIABLE {
      $$ = yy.createVariable($1);
    }
    | "_" {
      $$ = yy.createFreeVariable();
    }
    ;

atom
    : ATOM {
      $$ = yy.createAtom($1);
    }
    ;

atomOrVariableOrPredicateOrList
    : atomOrVariableOrPredicate -> $1
    | list - $1
    ;

atomOrVariableOrPredicate
    : atomOrVariable -> $1
    | predicate -> $1
    ;

atomOrVariable
    : atom -> $1
    | variable -> $1
    ;

atomOrVariableOrList
    : atomOrVariable -> $1
    | list -> $1
    ;

list
    : listHeadNonEmpty "|" opt_white atomOrVariableOrList opt_white "]" {
      $$ = yy.createList($1, $4);
    }
    | listHead "]" {
      $$ = yy.createList($1);
    }
    ;

listHeadNonEmpty
    : "[" opt_white atomOrVariableOrPredicateOrList opt_white -> [$3]
    | listHead "," opt_white atomOrVariableOrPredicateOrList opt_white {
      $1.push($4);
      $$ = $1;
    }
    ;

listHead
    : "[" opt_white -> []
    | listHeadNonEmpty -> $1
    ;
