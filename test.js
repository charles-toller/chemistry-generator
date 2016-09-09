/**
 * Created by Charles Toller on 9/8/2016.
 */
if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
        'use strict';
        if (this == null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}
var testArray = [{name:"object1"},{name:"object2"}];
var item = testArray.find(function(item) {
    return item.name == "object1"
});
item.name = "object3";
console.log(JSON.stringify(testArray));