const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { spawn } = require('child_process'); // Updated to use spawn instead of exec
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Function to execute the code
const executeCode = (code, language, input, callback) => {
    const fileName = `code.${language === 'python' ? 'py' : language === 'java' ? 'java' : 'c'}`;
    fs.writeFileSync(fileName, code);

    // Commands to compile and run code based on language
    let command, args = [];
    switch (language) {
        case 'python':
            command = 'python';
            args = [fileName];
            break;
        case 'java':
            command = 'javac';
            args = [fileName];
            break;
        case 'c':
            command = 'gcc';
            args = [fileName, '-o', 'code'];
            break;
        default:
            return callback('Unsupported language');
    }

    // Step 1: Compile the code (if needed)
    const compileProcess = spawn(command, args);

    compileProcess.on('close', (compileCode) => {
        if (compileCode !== 0) {
            return callback('Error during compilation');
        }

        // Step 2: Execute the code with user input
        let runProcess;
        if (language === 'python') {
            runProcess = spawn('python', [fileName]);
        } else if (language === 'java') {
            runProcess = spawn('java', [fileName.replace('.java', '')]);
        } else if (language === 'c') {
            runProcess = spawn('./code');
        }

        // Pass input to the program
        if (input) {
            runProcess.stdin.write(input + '\n');
        }
        runProcess.stdin.end();

        let output = '';
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        runProcess.stderr.on('data', (data) => {
            return callback(data.toString());
        });

        runProcess.on('close', (code) => {
            if (code !== 0) {
                return callback('Error during execution');
            }
            callback(null, output);
        });
    });
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

// Start the server
app.listen(5000, () => {
    console.log(`Server is running on http://localhost:5000`);
});
