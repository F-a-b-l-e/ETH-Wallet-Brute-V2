const fs = require('fs');
const ethers = require('ethers');
const blessed = require('blessed');
require('colors');
const path = require('path');

const privateKeyFilePath = path.join(__dirname, 'privatekey.txt');

// Check if the privatekey.txt file exists, and create it if it doesn't
if (!fs.existsSync(privateKeyFilePath)) {
    fs.writeFileSync(privateKeyFilePath, '', 'utf8'); // Create an empty private key file
}






// Read configuration from JSON file
const config = JSON.parse(fs.readFileSync('config.json'));

const ALCHEMY_API_KEY = config.alchemyApiKey;

if (!ALCHEMY_API_KEY) {
    console.error('Error: Alchemy API key is not set. Please set it in the config.json file.');
    process.exit(1);
}

// Configure WebSocket provider
const provider = new ethers.providers.WebSocketProvider(
    `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
);

// Create a screen object.
const screen = blessed.screen({
    smartCSR: true,
    title: 'ETH Fucker By @F_a_b_le'
});

// Create a box to hold the menu bar.
const menuBar = blessed.listbar({
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    mouse: true,
    keys: true,
    border: {
        type: 'line'
    },
    style: {
        bg: 'blue',
        item: {
            bg: 'blue',
            hover: {
                bg: 'red'
            }
        },
        selected: {
            bg: 'green'
        }
    },
    items: {
        'Start': {
            keys: ['s'],
            callback: () => {
                runChecks();
            }
        },
        'Exit': {
            keys: ['e'],
            callback: () => {
                provider.destroy();
                screen.destroy();
                process.exit();
            }
        }
    }
});

screen.append(menuBar);

// Create a box to hold the status bar.
const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    content: 'Checks: 0 | Total Balance: 0 ETH',
    style: {
        bg: 'green',
        fg: 'black'
    }
});

screen.append(statusBar);

// Create a log box to display checking data
const logBox = blessed.log({
    top: 3,
    left: 0,
    right: 0,
    bottom: 1,
    border: {
        type: 'line'
    },
    style: {
        fg: 'white',
        bg: 'black'
    },
    scrollbar: {
        ch: ' ',
        track: {
            bg: 'yellow'
        },
        style: {
            inverse: true
        }
    }
});

screen.append(logBox);

// Number of concurrent checks
const CONCURRENCY = 5;

// Metrics
let totalChecks = 0;
let totalBalance = ethers.BigNumber.from(0);

// Utility function to delay
const delay = time => new Promise(res => setTimeout(res, time));

// Function to check a single wallet
async function checkWallet() {
    try {
        const wallet = ethers.Wallet.createRandom();
        const address = wallet.address;
        const privateKey = wallet.privateKey;

        const balance = await provider.getBalance(address);
        totalChecks++;

        if (balance.gt(0)) {
            totalBalance = totalBalance.add(balance);
            const balanceInEth = ethers.utils.formatEther(balance);
            logBox.log(`Address: ${address.bgGreen.black} | Balance: ${balanceInEth.bgGreen.black}`);
            logBox.log('Private Key: '.yellow + privateKey);

            fs.appendFileSync('privatekey.txt', `${address},${privateKey},${balanceInEth}\n`);
        } else {
            logBox.log(`Address: ${address} | Balance: 0`.red);
        }

        // Update status bar
        const totalBalanceInEth = ethers.utils.formatEther(totalBalance);
        statusBar.setContent(`Checks: ${totalChecks} | Total Balance: ${totalBalanceInEth} ETH`);
        screen.render();
    } catch (error) {
        logBox.log('Error:'.red, error.message.red);
    }
}

// Function to run multiple checks concurrently
async function runChecks() {
    const tasks = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        tasks.push(checkWallet());
    }
    await Promise.all(tasks);
    runChecks(); // Continue running checks
}

// Render the screen.
screen.render();

// Clean up provider when script is terminated
process.on('SIGINT', () => {
    provider.destroy();
    screen.destroy();
    console.log('Provider destroyed. Exiting...');
    process.exit();
});
