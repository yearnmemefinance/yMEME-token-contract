const fs = require('fs'); 
const csv = require('csv-parser');

const inputFilePath= '../data/holders.csv';

const csvData=[];

fs.createReadStream(inputFilePath)
.pipe(csv())
.on('data', function(data){
    try {
        csvData.push(data);        

        //perform the operation
    }
    catch(err) {
        //error handler
    }
})
.on('end',function(){
    //some final operation
    console.log({
        csvData
    })
});  