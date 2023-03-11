"use strict";

const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });

let words = fs.readFileSync("./words.txt", "utf-8").split("\n");
let possibleWords = fs.readFileSync("./possibleSolutions.txt", "utf-8").split("\n");

let knowledge = {
    knownPositioned: [undefined, undefined, undefined, undefined, undefined],
    knownUnpositioned: [],
    disallowedPositions: {},
    maximums: {}
};

const firstGuess = {
    minimax: "raise",
    mean: "roate",
    median: "reist"
};

function getNextGuess(mode, silent) {
    possibleWords = pruneWords(knowledge, possibleWords);

    if (possibleWords.length == 1 || possibleWords.length == 2) {
        return possibleWords[0];
    } else if (possibleWords.length == 0) {
        console.log("There are no possible words - check to see if you mistyped something.");
        return;
    }

    if (mode == "simple") {
        return possibleWords[randomBetween(0, possibleWords.length - 1)];
    }

    let best = [undefined, Infinity];
    let startAt = 0;

    let began = new Date().getTime();
    for (let chooser = startAt; chooser < words.length; chooser++) {
        let choice = words[chooser];

        if (!silent) {
            let completed = chooser - startAt;
            let remaining = words.length - chooser;
            let elapsed = new Date().getTime() - began;
            let remTime = new Date(parseInt(((elapsed / completed) * remaining).toFixed(0)) || 0).toISOString().slice(11, 19);
            process.stdout.write("\r" + (chooser + 1) + "/" + words.length + " - " + ((chooser / words.length) * 100).toFixed(4) + "% complete - Time remaining: " + remTime + " - Best found: " + best[0] + ", reduces to " + parseFloat(best[1].toFixed(4)));
            process.stdout.clearLine(1);
        }

        let worstOutcome = 0;
        let sum = 0;
        let outcomes = {};
        for (let possible of possibleWords) {
            let wordsLeft = evaluateRemaining(choice, possible);

            worstOutcome = Math.max(worstOutcome, wordsLeft);
            sum += wordsLeft;
            if (!outcomes[wordsLeft]) {
                outcomes[wordsLeft] = 0;
            }
            outcomes[wordsLeft]++;
        }
        if (mode == "minimax") {
            if ((worstOutcome < best[1] && worstOutcome != 0) || (worstOutcome == best[1] && worstOutcome != 0 && possibleWords.includes(choice))) {
                best = [choice, worstOutcome];
            }
        } else if (mode == "mean") {
            let mean = sum / possibleWords.length;
            if ((mean < best[1] && worstOutcome != 0) || (mean < best[1] && worstOutcome != 0 && possibleWords.includes(choice))) {
                best = [choice, mean];
            }
        } else if (mode == "median") {
            let total = 0;
            for (let key in outcomes) {
                total += outcomes[key];
                if (total >= possibleWords.length / 2) {
                    if ((key < best[1] && key != 0) || (key < best[1] && key != 0 && possibleWords.includes(choice))) {
                        best = [choice, parseInt(key)];
                    }
                    break;
                }
            }
        } else {
            throw new Error(mode + " is not a valid strategy!");
        }
    }

    if (!silent) {
        process.stdout.write("\r");
        process.stdout.clearLine(1);
    }

    return best[0];
}

function combineKnowledge(original, add) {
    let newKnowledge = {
        knownPositioned: [undefined, undefined, undefined, undefined, undefined],
        knownUnpositioned: [],
        disallowedPositions: {},
        maximums: JSON.parse(JSON.stringify(original.maximums))
    };

    //Combine the known positioning data
    for (let i = 0; i < 5; i++) {
        newKnowledge.knownPositioned[i] = original.knownPositioned[i] || add.knownPositioned[i];
    }

    //Combine the known unpositioned data
    let unpositionedO = {};
    let unpositionedN = {};
    let combined = {};
    for (let char of original.knownUnpositioned) {
        if (!unpositionedO[char]) {
            unpositionedO[char] = 0;
        }
        unpositionedO[char]++;
    }
    for (let char of add.knownUnpositioned) {
        if (!unpositionedN[char]) {
            unpositionedN[char] = 0;
        }
        unpositionedN[char]++;
    }
    for (let char in unpositionedO) {
        if (!unpositionedN[char] || unpositionedO[char] >= unpositionedN[char]) {
            combined[char] = unpositionedO[char];
        }
    }
    for (let char in unpositionedN) {
        if (!unpositionedO[char] || unpositionedN[char] > unpositionedO[char]) {
            combined[char] = unpositionedN[char];
        }
    }
    for (let char in combined) {
        for (let i = 0; i < combined[char]; i++) {
            newKnowledge.knownUnpositioned.push(char);
        }
    }

    //Combine the disallowed positions
    let allKeys = [...new Set([...Object.keys(original.disallowedPositions), ...Object.keys(add.disallowedPositions)])];
    for (let key of allKeys) {
        newKnowledge.disallowedPositions[key] = [...new Set([...(original.disallowedPositions[key] || []), ...(add.disallowedPositions[key] || [])])];
    }

    //Combine the maximums data
    Object.assign(newKnowledge.maximums, add.maximums);

    return newKnowledge;
}

function pruneWords(pruneKnowledge, wordList) {
    let newList = [];
    outerLoop: for (let word of wordList) {
        for (let key in pruneKnowledge.maximums) {
            let count = 0;
            for (let char = 0; char < 5; char++) {
                if (word[char] == key) {
                    count++;
                    if (count > pruneKnowledge.maximums[key]) {
                        continue outerLoop;
                    }
                }
            }
        }
        for (let char = 0; char < 5; char++) {
            if (pruneKnowledge.knownPositioned[char] != undefined && word[char] != pruneKnowledge.knownPositioned[char]) {
                continue outerLoop;
            }
            if (pruneKnowledge.disallowedPositions[word[char]] && pruneKnowledge.disallowedPositions[word[char]].includes(char)) {
                continue outerLoop;
            }
        }
        let tracker = word;
        for (let char of pruneKnowledge.knownUnpositioned) {
            let index = tracker.indexOf(char);
            if (index != -1) {
                tracker = tracker.slice(0, index) + tracker.slice(index + 1);
            } else {
                continue outerLoop;
            }
        }
        newList.push(word);
    }
    return newList;
}

function evaluateWord(choice, actual) {
    //Figure out what the knowledge would be if this word was the real word
    let wordKnowledge = { knownPositioned: [undefined, undefined, undefined, undefined, undefined], knownUnpositioned: [], disallowedPositions: {}, maximums: {} };
    for (let char = 0; char < 5; char++) {
        if (!actual.includes(choice[char])) {
            //There are none of this character in the word
            wordKnowledge.maximums[choice[char]] = 0;
        } else if (choice[char] == actual[char]) {
            //This character is in the right place
            wordKnowledge.knownPositioned[char] = choice[char];
            wordKnowledge.knownUnpositioned.push(choice[char]);
        }
    }

    for (let char = 0; char < 5; char++) {
        if (actual.includes(choice[char]) && choice[char] != actual[char]) {
            //This character does occur at least once in the word, but is not in the right place

            //Count the occurrences of this character in both the choice and actual word
            let inActual = actual.split(choice[char]).length - 1;
            let inChoice = choice.split(choice[char]).length - 1;
            //Check how many of this character we already know about
            let alreadyDone = wordKnowledge.knownUnpositioned.filter((x) => x == choice[char]).length;

            if (alreadyDone < Math.min(inActual, inChoice)) {
                if (!wordKnowledge.disallowedPositions[choice[char]]) {
                    wordKnowledge.disallowedPositions[choice[char]] = [];
                }
                wordKnowledge.disallowedPositions[choice[char]].push(char);
            }

            //Make up the difference in unpositioned
            for (let i = 0; i < Math.min(inActual, inChoice) - alreadyDone; i++) {
                wordKnowledge.knownUnpositioned.push(choice[char]);
            }
            //Check if there too many of this character in our choice
            if (inActual < inChoice) {
                //There are less of this character in the real word, so we found a maximum as well
                wordKnowledge.maximums[choice[char]] = inActual;
            }
        }
    }
    return wordKnowledge;
}

//Generate a random number between min and max (inclusive)
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function evaluateRemaining(choice, possible) {
    let wordKnowledge = evaluateWord(choice, possible);

    let hypothetical = combineKnowledge(knowledge, wordKnowledge);

    let wordsLeft = pruneWords(hypothetical, possibleWords).length;

    return wordsLeft;
}

function evaluateStrategy(mode, hardMode) {
    let guessFrequencies = {};
    shuffleArray(possibleWords);
    let allPossible = JSON.parse(JSON.stringify(possibleWords));
    let allWords = JSON.parse(JSON.stringify(words));
    for (let possible of allPossible) {
        words = JSON.parse(JSON.stringify(allWords));
        possibleWords = JSON.parse(JSON.stringify(allPossible));
        knowledge = {
            knownPositioned: [undefined, undefined, undefined, undefined, undefined],
            knownUnpositioned: [],
            disallowedPositions: {},
            maximums: {}
        };
        let guesses = 1;
        while (true) {
            let guess;
            if (guesses == 1) {
                guess = firstGuess[mode];
            } else {
                if (hardMode) {
                    words = pruneWords(knowledge, words);
                }
                guess = getNextGuess(mode, true);
            }
            if (guess == possible) {
                break;
            }
            knowledge = combineKnowledge(knowledge, evaluateWord(guess, possible));
            guesses++;
        }
        if (!guessFrequencies[guesses]) {
            guessFrequencies[guesses] = 0;
        }
        guessFrequencies[guesses]++;
        process.stdout.write("\rGuess Frequencies: " + JSON.stringify(guessFrequencies).replace(/{/g, "{ ").replace(/}/g, " }").replace(/:/g, ": ").replace(/,/g, ", "));
        process.stdout.clearLine(1);
    }
    process.stdout.write("\n");
}

function resultToKnowledge(guess, result) {
    let wordKnowledge = {
        knownPositioned: [undefined, undefined, undefined, undefined, undefined],
        knownUnpositioned: [],
        disallowedPositions: {},
        maximums: {}
    };
    let foundMax = [];
    for (let char = 0; char < 5; char++) {
        if (result[char] == ".") {
            if (!foundMax.includes(guess[char])) {
                foundMax.push(guess[char]);
            }
        } else if (result[char] == result[char].toUpperCase()) {
            wordKnowledge.knownPositioned[char] = guess[char];
            wordKnowledge.knownUnpositioned.push(guess[char]);
        } else if (result[char] == result[char].toLowerCase()) {
            wordKnowledge.knownUnpositioned.push(guess[char]);
            if (!wordKnowledge.disallowedPositions[guess[char]]) {
                wordKnowledge.disallowedPositions[guess[char]] = [];
            }
            wordKnowledge.disallowedPositions[guess[char]].push(char);
        }
    }
    for (let char of foundMax) {
        wordKnowledge.maximums[char] = wordKnowledge.knownUnpositioned.filter((x) => x == char).length;
    }

    return wordKnowledge;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function checkRemaining() {
    let guesses = prompt("Please type each guess-its result, separated by commas: ")
        .split(",")
        .map((x) => x.split("-"));

    for (let set of guesses) {
        knowledge = combineKnowledge(knowledge, resultToKnowledge(set[0], set[1]));
    }

    console.log(pruneWords(knowledge, possibleWords));
}

function playGame(mode) {
    let commonOnly = prompt("Common words only? (y/n): ") == "y";
    let hardMode = prompt("Hard mode? (y/n): ") == "y";
    if (commonOnly) {
        words = JSON.parse(JSON.stringify(possibleWords));
    }

    const firstWord = commonOnly || hardMode ? "raise" : firstGuess[mode];

    console.log("Guess " + firstWord);
    words.splice(words.indexOf(firstWord), 1);
    let guessResult = prompt("Enter result (uppercase = correct pos, lowercase = incorrect pos, . = not included): ");
    knowledge = resultToKnowledge(firstWord, guessResult);
    while (true) {
        if (hardMode) {
            words = pruneWords(knowledge, words);
        }
        let guess = getNextGuess(mode, false);
        words.splice(words.indexOf(guess), 1);
        if (guess == undefined) {
            return;
        }
        if (possibleWords.length == 1) {
            console.log("The word is " + guess);
            return;
        } else {
            console.log("Guess " + guess);
        }
        let guessResult = prompt("Enter result (uppercase = correct pos, lowercase = incorrect pos, . = not included): ");
        knowledge = combineKnowledge(knowledge, resultToKnowledge(guess, guessResult));
    }
}

playGame("median");
