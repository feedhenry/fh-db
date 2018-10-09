var _ = require('lodash');

function translateObjects(fields) {
    var ret = fields;
    if (fields) {
        _.forOwn(fields, function(val,key,obj) {
            if(val['$date']) {
                var orig = val['$date']
                var converted = new Date(val['$date'])
                try {
                    converted.toISOString() // ensure valid date
                    obj[key] = converted
                }
                catch (e){
                    // if invalid date use the value as passed 
                    obj[key] = orig
                }
            }
        });
    }
    return ret;
}

exports.translateObjects = translateObjects;