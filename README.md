# Wordle Bot

This project came about when I realized that, in theory, it _shouldn't_ be _too_ hard to write a program that makes optimal Wordle guesses. This implementation aims to reduce the available possibilities as quickly as possible. There are a whole lot of ways that 'most reduction' can be measured, and this program offers three: reducing the median, mean, or maximum number of words remaining. These (understandably) produce different results that can't really be compared effectively, but each one never fails to guess the word, and typically guesses in at most four, often three words.

Running this program requires the **fs** and **prompt-sync** JS libraries.
