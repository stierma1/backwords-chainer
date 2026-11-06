var RuntimeEngine = require("../../lib/grammar/runtime-engine");

var TEST_TIMEOUT = 10000;

function test10(name, fn){
  test(name, fn, TEST_TIMEOUT);
}

function collect(gen, limit){
  var values = [];
  for(var value of gen){
    if(value !== null && value !== undefined){
      values.push(value);
    }
    if(limit && values.length >= limit){
      break;
    }
  }
  return values;
}

function valuesOf(results, name){
  return results.map(function(result){
    return result[name].toString();
  });
}

var LOGISTICS_RULES = `
  warehouse(north).
  warehouse(south).
  warehouse(east).

  goodsType(widgets, standard).
  goodsType(gadgets, standard).
  goodsType(vases, fragile).

  stock(north, widgets, 20).
  stock(north, gadgets, 10).
  stock(north, vases, 5).
  stock(south, widgets, 0).
  stock(south, gadgets, 15).
  stock(south, vases, 0).
  stock(east, widgets, 5).
  stock(east, gadgets, 0).
  stock(east, vases, 10).

  need(south, widgets, 10).
  need(south, vases, 5).
  need(east, gadgets, 8).

  % Weekly truck runs. Each option uses one truck run and has a fixed cost.
  option(o1, monday, north, south, widgets, 10, 4).
  option(o2, monday, north, south, vases, 5, 6).
  option(o3, tuesday, north, east, gadgets, 8, 5).
  option(o4, wednesday, east, south, vases, 5, 3).
  option(o5, thursday, north, east, vases, 5, 4).
  option(o6, friday, north, south, gadgets, 8, 7).
  optionList([o1, o2, o3, o4, o5, o6]).

  delivered([], _, _, 0).
  delivered([Id | Ids], D, I, Total) :-
    option(Id, _, _, D, I, Qty, _),
    delivered(Ids, D, I, Rest),
    +(Qty, Rest, Total).
  delivered([Id | Ids], D, I, Total) :-
    option(Id, _, _, To, _, _, _),
    not(=(To, D)),
    delivered(Ids, D, I, Total).
  delivered([Id | Ids], D, I, Total) :-
    option(Id, _, _, D, Item, _, _),
    not(=(Item, I)),
    delivered(Ids, D, I, Total).

  usedFrom([], _, _, 0).
  usedFrom([Id | Ids], W, I, Total) :-
    option(Id, _, W, _, I, Qty, _),
    usedFrom(Ids, W, I, Rest),
    +(Qty, Rest, Total).
  usedFrom([Id | Ids], W, I, Total) :-
    option(Id, _, From, _, _, _, _),
    not(=(From, W)),
    usedFrom(Ids, W, I, Total).
  usedFrom([Id | Ids], W, I, Total) :-
    option(Id, _, W, _, Item, _, _),
    not(=(Item, I)),
    usedFrom(Ids, W, I, Total).

  optionCost([], 0).
  optionCost([Id | Ids], Total) :-
    option(Id, _, _, _, _, _, Cost),
    optionCost(Ids, Rest),
    +(Cost, Rest, Total).

  deliveredAtLeast(S, D, I, Q) :-
    delivered(S, D, I, Total),
    >=(Total, Q).

  usedAtMost(S, W, I, Available) :-
    usedFrom(S, W, I, Used),
    <=(Used, Available).

  satisfiesDemands(S) :-
    forall(need(D, I, Q), deliveredAtLeast(S, D, I, Q)).

  withinStock(S) :-
    forall(stock(W, I, Available), usedAtMost(S, W, I, Available)).

  choose([], []).
  choose([X | Xs], [X | Ys]) :- choose(Xs, Ys).
  choose([_ | Xs], Ys) :- choose(Xs, Ys).

  feasiblePlan(Cost, Selected) :-
    optionList(Options),
    choose(Options, Selected),
    Selected \\= [],
    satisfiesDemands(Selected),
    withinStock(Selected),
    optionCost(Selected, Cost).

  bestSchedule(Cost, Plan) :-
    aggregate_all(min(Cost), feasiblePlan(Cost, Plan), Cost),
    feasiblePlan(Cost, Plan).

  planDays([], []).
  planDays([Id | Ids], [Day | Days]) :-
    option(Id, Day, _, _, _, _, _),
    planDays(Ids, Days).

  planItems(Plan, Items) :-
    findall(Item, (member(Id, Plan), option(Id, _, _, _, Item, _, _)), Items).

  optimalSchedule(Cost, Plan, Days, Items) :-
    bestSchedule(Cost, Plan),
    planDays(Plan, Days),
    planItems(Plan, Items).

  allFeasibleCosts(Costs) :-
    findall(Cost, feasiblePlan(Cost, _), AllCosts),
    sort(AllCosts, Costs).
`;

test10("logistics domain models warehouses, goods, stock, demand, and weekly options", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(LOGISTICS_RULES);

  expect(collect(rt.run("warehouse(north)")).length).toBe(1);
  expect(collect(rt.run("warehouse(east)")).length).toBe(1);
  expect(collect(rt.run("goodsType(vases, fragile)")).length).toBe(1);
  expect(collect(rt.run("stock(north, widgets, 20)")).length).toBe(1);
  expect(collect(rt.run("need(south, vases, 5)")).length).toBe(1);
  expect(valuesOf(collect(rt.run("optionList(L)")), "L").length).toBe(1);
});

test10("the solver checks demand satisfaction and stock limits independently", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(LOGISTICS_RULES);

  expect(collect(rt.run("satisfiesDemands([o1, o3])")).length).toBe(0);
  expect(collect(rt.run("satisfiesDemands([o1, o3, o4])")).length).toBe(1);
  expect(collect(rt.run("withinStock([o1, o3, o4])")).length).toBe(1);
  expect(collect(rt.run("withinStock([o2, o5])")).length).toBe(0);
  expect(collect(rt.run("delivered([o1, o3, o4], south, widgets, T), >=(T, 10)")).length).toBe(1);
  expect(collect(rt.run("usedFrom([o1, o3, o4], north, gadgets, U), <=(U, 10)")).length).toBe(1);
});

test10("the solver enumerates all feasible weekly plans", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(LOGISTICS_RULES);

  var plans = collect(rt.run("feasiblePlan(Cost, Plan)"));
  expect(plans.length).toBe(4);
  expect(plans.map(function(plan){ return plan.Cost.toString(); }).sort()).toEqual(["12", "15", "16", "18"]);
});

test10("the solver finds the optimal schedule by minimum total cost", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(LOGISTICS_RULES);

  var results = collect(rt.run("optimalSchedule(Cost, Plan, Days, Items)"));
  expect(results.length).toBe(1);

  expect(results[0].Cost.toString()).toBe("12");
  expect(results[0].Plan.toString()).toBe("[o1 | [o3 | [o4 | []]]]");
  expect(results[0].Days.toString()).toBe("[monday | [tuesday | [wednesday | []]]]");
  expect(results[0].Items.toString()).toBe("[widgets | [gadgets | [vases | []]]]");
});

test10("the optimal plan is stable under aggregation and sorting", () => {
  var rt = new RuntimeEngine();
  rt.loadDefaults();
  rt.parseRules(LOGISTICS_RULES);

  expect(valuesOf(collect(rt.run("allFeasibleCosts(Costs)")), "Costs")).toEqual(["[12 | [15 | [16 | [18 | []]]]]"]);
  expect(valuesOf(collect(rt.run("aggregate_all(min(C), feasiblePlan(C, _), C)")), "C")).toEqual(["12"]);
  expect(valuesOf(collect(rt.run("aggregate_all(sum(C), feasiblePlan(C, _), C)")), "C")).toEqual(["61"]);
});
