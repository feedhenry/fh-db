var assert = require('assert');
var translateObjects = require("../lib/translateobjects.js").translateObjects;


exports['test no translation'] = function (done) {
    var translated = translateObjects({
        "firstName" : "Joe",
        "when" : "2018-10-08T16:44:39.503Z"
    });
    assert.ok(translated, 'unexpected null value returned');
    assert.equal(translated.firstName, "Joe")
    assert.equal(typeof translated.when, "string")
    assert.ok(translated.when, "2018-10-08T16:44:39.503Z")
    done();
}

exports['test empty params'] = function (done) {
    var translated = translateObjects({});
    assert.ok(translated, 'expected object returned');

    translated = translateObjects();
    assert.ok(!translated, "expected null/undefined returned");
    done();
}

exports['test translate date'] = function (done) {
    var translated = translateObjects({
        "firstName" : "Joe",
        "when" : {
            $date: "2018-10-08T16:44:39.503Z"
        }
    });
    assert.ok(translated, 'expected object to be returned');
    assert.equal(translated.firstName, "Joe");
    assert.equal(typeof translated.when, "object");
    assert.ok(translated.when instanceof Date, 'expected when field to be an instances of Date object')
    assert.equal(translated.when.getMinutes(), 44)
    assert.equal(translated.when.toISOString(), "2018-10-08T16:44:39.503Z")
    done();
}

exports['test translate with invalid date'] = function (done) {
    var translated = translateObjects({
        "firstName" : "Joe",
        "when" : {
            $date: "Jim"
        }
    });
    assert.ok(translated, 'unexpected null value returned');
    assert.equal(translated.firstName, "Joe")
    assert.equal(typeof translated.when, "string")
    assert.ok(translated.when, "Jim")
    done();
}

