var ObjectId = require('mongodb').ObjectId;

/**
 * Creates an object containing the expression key and value queried.
 *
 * @param {String} expression - This is the operator used in query.
 * @param {String} field - This is the column being quried.
 * @param {ObjectId|Number|Boolean} value - This is the value being quried.
 *
 * @returns {Object} expressionQuery - contains the expressions key and query value.
 */
function query(value, field, expression) {
    if (!expression) {
        return value;
    }

    var expressionQuery = {};
    expressionQuery[expression] = value;
    return expressionQuery;
};

/**
 * Tries to create a Number from the queried value.
 *
 * @param {String} value - This is the value being quried.
 *
 * @returns {Number}
 */
function number(value) {
    var num = Number(value);
    if (!Number.isNaN(num)) {
        return num;
    }
};

/**
 * Tries to create an ObjectId from the queried value.
 *
 * @param {String} value - This is the value being quried.
 *
 * @returns {ObjectId}
 */
function objectId(value) {
    try {
        return ObjectId(value);
    } catch (err) { };
};

/**
 * Tries to create a Boolean from the queried value.
 *
 * @param {String} value - This is the value being quried.
 *
 * @returns {Boolean}
 */
function bool(value) {
    if (value.toLowerCase() === 'true') {
        return true;
    } else if (value.toLowerCase() === 'false') {
        return false;
    }
};

// used to call parsing function for the "Any" type.
var casters = [
    number,
    bool,
    objectId
];

// contains functions to convert queries based on their type.
var queryTypes = {
    "Date": function (value, field, expression) {
        return query(new Date(value), field, expression); // if a non date is input it will parse to a date anyway
    },
    "ObjectId": function (value, field, expression) {
        return query(ObjectId(value), field, expression); // ngui will throw an error if this is not equal 24 char
    },
    "Any": function (value, field, expression) {
        var compositeQuery = {};
        compositeQuery[field] = query(value, field, expression);
        var str = compositeQuery;
        return casters.reduce(function (acc, caster) {
            var val = caster(value);
            if (typeof val !== "undefined") {
                compositeQuery[field] = query(val, field, expression);
                acc.push(compositeQuery);
            }
            return acc;
        }, [str]);
    }
};

/**
 * Converts the query based on the type of query and if an expression was used
 *
 * @param {Object} type - Type will contain the type and value being queried. Type can have these values: "String", "Number", "Boolean", "Date", "ObjectId" or "Any".
 * @param {String} field - This is the column being quried.
 * @param {String} expression - This is the operator used in query e.g. "$ne" (not equal).
 *
 * @returns {String|Number|Boolean|Object}
 */
exports.queryType = function (type, field, expression) {
    if (!queryTypes[type.type]) {
        return query(type.value, field, expression);
    }
    return queryTypes[type.type](type.value, field, expression);
};