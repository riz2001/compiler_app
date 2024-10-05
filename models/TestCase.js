const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    language: { type: String, required: true },
});

const TestCase = mongoose.model('TestCase', testCaseSchema);

module.exports = TestCase;
