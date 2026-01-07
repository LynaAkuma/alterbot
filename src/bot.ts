import 'dotenv/config';
import Mineflayer from 'mineflayer';
import { sleep, getRandom } from "./utils.ts";
import CONFIG from "../config.json" with {type: 'json'};

let loop: NodeJS.Timer;
let bot: Mineflayer.Bot;

// Get config from env vars with fallback to config.json
const getConfig = () => ({
        host: process.env.HOST || CONFIG.client.host,
        port: process.env.PORT || CONFIG.client.port,
        username: process.env.USERNAME || CONFIG.client.username,
        retryDelay: process.env.RETRY_DELAY ? +process.env.RETRY_DELAY : CONFIG.action.retryDelay,
        initialRetryDelay: process.env.INITIAL_RETRY_DELAY ? +process.env.INITIAL_RETRY_DELAY : 60000, // 1 minute default
});

const disconnect = (): void => {
        clearInterval(loop);
        bot?.quit?.();
        bot?.end?.();
};

const reconnect = async (): Promise<void> => {
        const config = getConfig();
        console.log(`Trying to reconnect in ${config.retryDelay / 1000} seconds...\n`);

        disconnect();
        await sleep(config.retryDelay);
        createBot();
        return;
};

const createBot = (): void => {
        const config = getConfig();
        
        console.log(`Connecting to ${config.host}:${config.port} as ${config.username}...`);
        
        bot = Mineflayer.createBot({
                host: config.host,
                port: +config.port,
                username: config.username
        } as const);


        bot.once('error', async (error) => {
                console.error(`AFKBot got an error: ${error}`);
                
                // Retry on initial connection error
                console.log(`Connection failed. Retrying in ${config.initialRetryDelay / 1000} seconds (1 minute)...`);
                disconnect();
                await sleep(config.initialRetryDelay);
                createBot();
        });
        
        bot.once('kicked', rawResponse => {
                console.error(`\n\nAFKbot is disconnected: ${rawResponse}`);
        });
        bot.once('end', () => void reconnect());

        bot.once('spawn', () => {
                const changePos = async (): Promise<void> => {
                        const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
                        const halfChance: boolean = Math.random() < 0.5? true : false; // 50% chance to sprint

                        console.debug(`${lastAction}${halfChance? " with sprinting" : ''}`);

                        bot.setControlState('sprint', halfChance);
                        bot.setControlState(lastAction, true); // starts the selected random action

                        await sleep(CONFIG.action.holdDuration);
                        bot.clearControlStates();
                        return;
                };
                const changeView = async (): Promise<void> => {
                        const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI),
                                pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
                        
                        await bot.look(yaw, pitch, false);
                        return;
                };
                
                loop = setInterval(() => {
                        changeView();
                        changePos();
                }, CONFIG.action.holdDuration);
        });
        bot.once('login', () => {
                console.log(`AFKBot logged in ${bot.username}\n\n`);
        });
};



export default (): void => {
        createBot();
};