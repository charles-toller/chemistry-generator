/**
 * Created by Charles on 10/13/2016.
 */
var kue = require('kue');
var queue;
if(process.env.REDIS_HOST) {
    queue = kue.createQueue({
        redis:{
            host:process.env.REDIS_HOST
        }
    });
}
else if(process.env.REDIS_SOCKET) {
    queue = kue.createQueue({
        redis:{
            socket:process.env.REDIS_SOCKET
        }
    });
}
else {
    queue = kue.createQueue();
}
queue.process('bond',10000,function(job,ctx,done){
    var lewisStructure = job.data.lewisStructure;
    var wantedStructures = job.data.wantedStructures;
    var nextBondId = job.data.nextBondId;
    var maxSpawns = job.data.maxSpawns;
    //console.log("Now processing nextBondId: "+nextBondId);
    if(lewisStructure.filter(function(element){
            return element.amountOfBonds !== element.bonds.length;
        }).length === 0) {
        //Check to ensure no atoms are orphaned...
        var goodElements = lewisStructure.filter(function(element){
            var elementsFound = [element.id];
            var findBoundElement = function(bondId,thisElementId) {
                return lewisStructure.filter(function(newElement){
                    return newElement.bonds.indexOf(bondId) !== -1 && newElement.id !== thisElementId;
                })[0];
            };
            var findElements = function(element2) {
                element2.bonds.forEach(function(bond){
                    var otherElement = findBoundElement(bond,element2.id);
                    if(elementsFound.indexOf(otherElement.id) === -1) {
                        elementsFound.push(otherElement.id);
                        findElements(otherElement);
                    }
                });
            };
            findElements(element);
            if(elementsFound.length == lewisStructure.length) {
                return true;
            }
        }).length;
        if(goodElements == lewisStructure.length) {
            //console.log("job done, new lewis structure: "+JSON.stringify(lewisStructure));
            queue.create('solution'+job.data.equation, {solution:lewisStructure}).save();
            done();
            return;
        }
        else {
            //console.log("job done, no solutions");
            done();
            return;
        }
    }
    if(lewisStructure.filter(function(element){
            return element.amountOfBonds !== element.bonds.length;
        }).length === 1) {
        //console.log("unbondable element, returning no solutions");
        done();
        return;
    }
    var possibleSolutions = [];
    var jobs = [];
    lewisStructure.filter(function(element){
        return element.amountOfBonds !== element.bonds.length;
    }).forEach(function(element){
        if(wantedStructures <= possibleSolutions.length && wantedStructures !== -1) {
            return;
        }
        var realBondIdentitiesTried= [];
        lewisStructure.filter(function(element2){
            return element2.amountOfBonds !== element2.bonds.length && element2.id !== element.id;
        }).forEach(function(element2) {
            if(wantedStructures <= possibleSolutions.length && wantedStructures !== -1) {
                return;
            }
            var myRealBondIdentity = element2.bonds.map(function(bond){
                var bondedTo = lewisStructure.filter(function(bondElement){
                    return bondElement.bonds.indexOf(bond) !== -1 && bondElement.id != element2.id;
                })[0];
                return bondedTo.id;
            }).sort();
            if(realBondIdentitiesTried.indexOf(JSON.stringify(myRealBondIdentity))) {
                realBondIdentitiesTried.push(JSON.stringify(myRealBondIdentity));
                var newLewisStructure = JSON.parse(JSON.stringify(lewisStructure));
                var newElement = newLewisStructure.find(function(e){return e.id === element.id;});
                var newElement2 = newLewisStructure.find(function(e){return e.id === element2.id;});
                newElement.bonds.push(nextBondId);
                newElement2.bonds.push(nextBondId);
                jobs.push(newLewisStructure);
            }
        });
    });
    //console.log("created "+jobs.length+" jobs");
    var currentJob = 0;
    function nextJob() {
        //console.log("starting job id: "+currentJob);
        if(typeof jobs[currentJob] === 'undefined') {
            return false;
        }
        queue.create('bond',{
            lewisStructure:jobs[currentJob],
            nextBondId:nextBondId+1,
            wantedStructures:wantedStructures,
            maxSpawns:maxSpawns,
            equation:job.data.equation
        }).removeOnComplete(true).save().on("complete",function(){});
        return true;
    }
    while(nextJob()) {
        currentJob++;
    }
    nextJob();
});