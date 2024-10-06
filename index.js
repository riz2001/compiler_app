const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const mongoose = require('mongoose');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());


mongoose.connect('mongodb+srv://rizwan2001:rizwan2001@cluster0.6ucejfl.mongodb.net/compiler?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });



// Middleware


// Question Schema
const questionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    inputFormat: { type: String, required: true },
    outputFormat: { type: String, required: true },
    testCases: [{ input: String, expectedOutput: String }], // Test cases structured as objects
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    week: { type: Number, required: true }
});

// Question Model
const Question = mongoose.model('Question', questionSchema);


// Function to execute the code
const executeCode = (code, language, input, callback) => {
    const fileName = `Main.${language === 'python' ? 'py' : language === 'java' ? 'java' : 'c'}`;
    fs.writeFileSync(fileName, code);

    let command, args;

    switch (language) {
        case 'python':
            // First, try using 'python', then fallback to 'python3' if 'python' fails
            command = 'python'; // Try 'python'
            args = [fileName];

            const pythonProcess = spawn(command, args);

            let pythonOutput = '';
            let pythonError = '';

            pythonProcess.stdin.write(input); // Pass the input to stdin
            pythonProcess.stdin.end(); // Close stdin after input is passed

            pythonProcess.stdout.on('data', (data) => {
                pythonOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                pythonError += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0 || pythonError) {
                    // If 'python' fails, fallback to 'python3'
                    command = 'python'; // Try 'python3'
                    const python3Process = spawn(command, args);

                    let python3Output = '';
                    let python3Error = '';

                    python3Process.stdin.write(input); // Pass the input to stdin
                    python3Process.stdin.end(); // Close stdin after input is passed

                    python3Process.stdout.on('data', (data) => {
                        python3Output += data.toString();
                    });

                    python3Process.stderr.on('data', (data) => {
                        python3Error += data.toString();
                    });

                    python3Process.on('close', (code) => {
                        if (code !== 0 || python3Error) {
                            callback(python3Error || 'Error executing Python code');
                        } else {
                            callback(null, python3Output.trim());
                        }
                    });
                } else {
                    callback(null, pythonOutput.trim());
                }
            });
            return;

        case 'java':
            // First, compile the Java file
            command = 'javac';
            args = [fileName];

            const compileProcess = spawn(command, args);

            compileProcess.on('close', (code) => {
                if (code !== 0) {
                    return callback('Error compiling Java code');
                }

                // If compilation succeeds, execute the compiled Java program
                command = 'java';
                args = ['Main']; // The compiled class file name is 'Main'

                const runProcess = spawn(command, args);

                let output = '';
                let error = '';

                runProcess.stdin.write(input); // Pass the input to stdin
                runProcess.stdin.end(); // Close stdin after input is passed

                runProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                runProcess.stderr.on('data', (data) => {
                    error += data.toString();
                });

                runProcess.on('close', (code) => {
                    if (code !== 0 || error) {
                        callback(error || 'Execution error');
                    } else {
                        callback(null, output.trim());
                    }
                });
            });
            return;

        case 'c':
            // Compile the C code
            command = 'gcc';
            args = [fileName, '-o', 'code']; // Output executable will be named 'code.exe'

            const compileCProcess = spawn(command, args);

            compileCProcess.on('close', (compileCode) => {
                if (compileCode !== 0) {
                    return callback('Error compiling C code');
                }

                // Execute the compiled code (use 'code.exe' on Windows)
                const runCProcess = spawn('./code.exe'); // For Windows

                let output = '';
                let error = '';

                runCProcess.stdin.write(input); // Pass input to stdin
                runCProcess.stdin.end(); // Close stdin after input

                runCProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                runCProcess.stderr.on('data', (data) => {
                    error += data.toString();
                });

                runCProcess.on('close', (runCode) => {
                    if (runCode !== 0 || error) {
                        callback(error || 'Execution error');
                    } else {
                        callback(null, output.trim());
                    }
                });
            });
            return;

        default:
            return callback('Unsupported language');
    }
};

// Route to run code
app.post('/api/compiler/run', (req, res) => {
    const { code, language, input, expectedOutput } = req.body;

    // Validate input
    if (!code || !language || expectedOutput === undefined) {
        return res.status(400).json({ error: 'Code, language, and expected output are required.' });
    }

    // Run the code with input
    executeCode(code, language, input, (err, output) => {
        if (err) {
            return res.status(500).json({ output: 'Error executing code', error: err });
        }

        // Trim both output and expectedOutput before comparison
        const testPassed = output.trim() === expectedOutput.trim();

        res.json({
            output,
            result: {
                expected: expectedOutput,
                actual: output,
                passed: testPassed,
            },
        });
    });
});


// Route to add a new coding question
app.post('/api/questions', (req, res) => {
    const { title, description, inputFormat, outputFormat, testCases, difficulty, week } = req.body;

    if (!title || !description || !inputFormat || !outputFormat || !testCases || !difficulty || !week) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const newQuestion = new Question({
        title,
        description,
        inputFormat,
        outputFormat,
        testCases: testCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput })), // Map test cases to objects
        difficulty,
        week
    });

    newQuestion.save()
        .then(() => res.status(201).json({ message: 'Question added successfully!' }))
        .catch(err => res.status(500).json({ error: err.message }));
});


// Start the server
app.listen(5000, () => {
    console.log(`Server is running on http://localhost:5000`);
});