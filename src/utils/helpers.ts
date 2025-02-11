export const getRandomInterval=()=> {
    return Math.floor(Math.random() * (60 - 10 + 1) + 10) * 1000; // Random value between 10s and 60s
}