/**
 * Created by Charles Toller on 9/8/2016.
 */
var kue = require('kue');
var cpus = require('os').cpus().length;
var child = require('child_process');
if(process.env.LOCAL_SPAWN == 'true'){
    for(var i = 0;i<cpus;i++) {
        child.fork("./worker.js");
    }
}
var queue = kue.createQueue({
    redis:{
        host:process.env.REDIS_HOST
    }
});
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
var periodicTable = {
    "H": {
        name:"Hydrogen",
        amountOfBonds:1,
        bonds:[],
        lonePairs:0,
        symbol:"H"
    },
    "He": {
        name:"Helium",
        amountOfBonds:0,
        bonds:[],
        lonePairs:1,
        symbol:"He"
    },
    "Li":{
        name:"Lithium",
        amountOfBonds:1,
        bonds:[],
        lonePairs:0,
        symbol:"Li"
    },
    "Be":{
        name:"Beryllium",
        amountOfBonds:0,
        bonds:[],
        lonePairs:0,
        symbol:"Be"
    },
    "B":{
        name:"Boron",
        amountOfBonds:3,
        bonds:[],
        lonePairs:0,
        symbol:"B"
    },
    "C":{
        name:"Carbon",
        amountOfBonds:4,
        bonds:[],
        lonePairs:0,
        symbol:"C"
    },
    "N":{
        name:"Nitrogen",
        amountOfBonds:3,
        bonds:[],
        lonePairs:1,
        symbol:"N"
    },
    "O":{
        name:"Oxygen",
        amountOfBonds:2,
        bonds:[],
        lonePairs:2,
        symbol:"O"
    },
    "F":{
        name:"Florine",
        amountOfBonds:1,
        bonds:[],
        lonePairs:3,
        symbol:"F"
    }
};
var parseEquation = function(equation) {
    var newEquation;
    var lewisStructure = [];
    newEquation = equation.split(/(\d)+/g);
    var id = 0;
    newEquation.forEach(function(symbol,index){
        if((/[0-9]/g).test(symbol) || !symbol) {
            return;
        }
        if(typeof periodicTable[symbol] === 'undefined') {
            throw new TypeError("Symbol " + symbol + " is not defined in this context.");
        }
        var numberOfTimes = (typeof periodicTable[newEquation[index+1]] === 'undefined') ? newEquation[index+1]:1;
        for(var i = 0;i<numberOfTimes;i++) {
            var copyOfElement = JSON.parse(JSON.stringify(periodicTable[symbol]));
            copyOfElement.id = id++;
            lewisStructure.push(copyOfElement);
        }
    });
    return lewisStructure;
};
var express = require('express');
var app = express();
var solutions = {};
var inProgress = [];
app.get('/solutions/:equation/:numberOfSolutions',function(req,res){
    if(!req.params.equation) {
        res.send(JSON.stringify({
            status: "failure",
            failure_reason: "no equation present"
        }));
        return;
    }
    if(!req.params.numberOfSolutions) {
        res.send(JSON.stringify({
            status: "failure",
            failure_reason: "specify solutions wanted"
        }));
        return;
    }
    if(typeof solutions[req.params.equation] !== 'undefined') {
        res.send(JSON.stringify({
            status:"done",
            solutions:solutions[req.params.equation]
        }));
        return;
    }
    if(inProgress.indexOf(req.params.equation) !== -1) {
        res.send(JSON.stringify({
            status:"in_progress"
        }));
        return;
    }
    var lewisStructure;
    try {
        lewisStructure = parseEquation(req.params.equation);
    }
    catch(e) {
        res.send(JSON.stringify({
            status: "failure",
            failure_reason: e.toString()
        }));
        return;
    }
    queue.create('bond',{
        lewisStructure:lewisStructure,
        wantedStructures:req.params.numberOfSolutions,
        nextBondId:0,
        maxSpawns:1,
        equation:req.params.equation
    }).save().on('complete',()=>{});
    queue.process('solution'+req.params.equation,function(solution){
        if(!Array.isArray(solutions[req.params.equation])) {
            solutions[req.params.equation] = [];
        }
        solutions[req.params.equation].push(solution.data.solution);
        solutions[req.params.equation] = solutions[req.params.equation].map(function(item){
            item.map(function(element){
                delete element.id;
                return element;
            });
            return JSON.stringify(item);
        }).filter(function(item,index,array){
            return array.indexOf(item) === index;
        }).map(function(item){
            return JSON.parse(item);
        });
    });
    res.send(JSON.stringify({
        status:"in_progress"
    }));
});
app.listen(3000);