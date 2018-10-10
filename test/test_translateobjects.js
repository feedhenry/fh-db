var assert = require('assert');
var translateObjects = require("../lib/translateobjects.js");


exports['test no translation'] = function (done) {
    var translated = translateObjects.translateObjects({
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
    var translated = translateObjects.translateObjects({});
    assert.ok(translated, 'expected object returned');

    translated = translateObjects.translateObjects();
    assert.ok(!translated, "expected null/undefined returned");
    done();
}

exports['test translate date'] = function (done) {
    var translated = translateObjects.translateObjects({
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
    var translated = translateObjects.translateObjects({
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


exports['test field to meta, with no date'] = function (done) {
    var translated = translateObjects.translateDateObject("hello");
    assert.ok(translated, 'unexpected null value returned');
    assert.equal(translated, "hello")
    done();
}

exports['test field to meta, with date'] = function (done) {
    var translated = translateObjects.translateDateObject(new Date("2018-10-08T16:44:39.503Z"));
    assert.ok(translated, 'expected object to be returned');
    assert.equal(typeof translated, "object");
    assert.ok(translated["$date"], 'expected $date meta field')
    assert.equal(translated["$date"], "2018-10-08T16:44:39.503Z")
    done();
}
