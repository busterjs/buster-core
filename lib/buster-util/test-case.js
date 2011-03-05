var sys = require("sys");

function red(str) {
    return "\033[31m" + str + "\033[39m";
};

function green(str) {
    return "\033[32m" + str + "\033[39m";
};

function fireCompleteCallbackIfDone(testCase) {
    if (testCase.testsRun == testCase.totalTests &&
        typeof module.exports.onTestCaseFinished == "function") {
        module.exports.onTestCaseFinished();
    }
}

var asyncTestQueue = [];
function onAsyncTestFinished() {
    var test = asyncTestQueue.shift();

    if (asyncTestQueue.length > 0) {
        asyncTestQueue[0]();
    }

    if (!test) {
        return;
    }

    fireCompleteCallbackIfDone(test.testCase);
};

function asyncTest(testFunction) {
    var asyncTestFunction = function () {
        var self = this;
        process.nextTick(function () {
            testFunction.call(self, self);
        });
    };
    asyncTestFunction.async = true;
    return asyncTestFunction;
}

module.exports = function (name, tests) {
    var failedTests = {};
    tests.testsRun = 0;
    tests.totalTests = 0;

    sys.print(name + ": ");
    for (var test in tests) {
        if (test == "setUp" || test == "tearDown" || typeof tests[test] != "function") {
            continue;
        }

        tests.totalTests++;

        if (!tests[test].async && tests[test].length == 1) {
            tests[test] = asyncTest(tests[test]);
        }

        if (tests[test].async) {
            asyncTestQueue.push((function (test) {
                var testFunc = function () {
                    var scope = {};
                    var timeout = setTimeout(function () {
                        tests.testsRun += 1;
                        if (tests.tearDown) tests.tearDown.call(scope);
                        sys.puts(red("[ASYNC][TIMEOUT] " + test));
                        onAsyncTestFinished();
                    }, 2000);
                    scope.end = function (num) {
                        function complete() {
                            tests.testsRun += 1;
                            clearTimeout(timeout);

                            if (tests.tearDown) {
                                tests.tearDown.call(scope);
                            }

                            sys.puts(green("[ASYNC] " + test));
                            onAsyncTestFinished();
                        }

                        if (num) {
                            setTimeout(complete, num);
                        } else {
                            complete();
                        }
                    };

                    if (tests.setUp) {
                        tests.setUp.call(scope);
                    }

                    tests[test].call(scope);
                };

                testFunc.testCase = tests;

                return testFunc;
            }(test)));

            if (asyncTestQueue.length == 1) {
                asyncTestQueue[0]();
            }
            sys.print(green("."));
        } else {
            try {
                tests.testsRun += 1;
                var scope = {};
                if (tests.setUp) tests.setUp.call(scope);
                tests[test].call(scope);
                if (tests.tearDown) tests.tearDown.call(scope);
                sys.print(green("."));
            } catch (e) {
                sys.print(red(".")); 
                failedTests[test] = e;
            }
        }
    }

    fireCompleteCallbackIfDone(tests);
    sys.puts("");

    for (var failedTest in failedTests) {
        var e = failedTests[failedTest];
        sys.puts(red(failedTest + " failed: ") + e.toString());
        if (e.stack) {
            sys.puts(e.stack.split("\n").slice(1).join("\n"));
        }
    }
};

// Can be used to create asynchronous tests. I.e.:
//
//   testCase("foo", {
//       "test me": testCase.async(function (self) {
//           doAsyncStuff(function () {
//               self.end(); // call when test is finished
//           });
//       })
//   });
module.exports.async = asyncTest;