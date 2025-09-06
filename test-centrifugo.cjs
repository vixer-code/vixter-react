const { Centrifuge } = require('centrifuge');
const fetch = require('node-fetch').default || require('node-fetch');
const WebSocket = require('ws');

class CentrifugoTester {
    constructor() {
        this.centrifuge = null;
        this.subscription = null;
        this.receivedMessages = [];
    }

    async getToken(userId) {
        console.log(`🔑 Getting token for user: ${userId}`);
        try {
            const response = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Token received: ${data.token.substring(0, 30)}...`);
            return data.token;
        } catch (error) {
            console.error(`❌ Token error: ${error.message}`);
            throw error;
        }
    }

    async connect(userId) {
        console.log(`\n🔌 Connecting to Centrifugo as user: ${userId}`);
        
        try {
            const token = await this.getToken(userId);
            
            this.centrifuge = new Centrifuge('wss://vixter-centrifugo.fly.dev/connection/websocket', {
                token: token,
                getToken: () => this.getToken(userId),
                websocket: WebSocket
            });

            return new Promise((resolve, reject) => {
                this.centrifuge.on('connecting', (ctx) => {
                    console.log(`🔄 Connecting: ${ctx.code} - ${ctx.reason}`);
                });

                this.centrifuge.on('connected', (ctx) => {
                    console.log(`✅ Connected via ${ctx.transport}`);
                    resolve(ctx);
                });

                this.centrifuge.on('disconnected', (ctx) => {
                    console.log(`❌ Disconnected: ${ctx.code} - ${ctx.reason}`);
                });

                this.centrifuge.on('error', (ctx) => {
                    console.error(`❌ Connection error: ${ctx.message}`);
                    reject(new Error(ctx.message));
                });

                // Set timeout for connection
                setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.centrifuge.connect();
            });
        } catch (error) {
            console.error(`❌ Connection failed: ${error.message}`);
            throw error;
        }
    }

    async subscribe(channelName) {
        console.log(`\n📡 Subscribing to channel: ${channelName}`);
        
        if (!this.centrifuge) {
            throw new Error('Not connected to Centrifugo');
        }

        return new Promise((resolve, reject) => {
            this.subscription = this.centrifuge.newSubscription(channelName);

            this.subscription.on('publication', (ctx) => {
                console.log(`📨 RECEIVED MESSAGE: ${JSON.stringify(ctx.data, null, 2)}`);
                this.receivedMessages.push({
                    timestamp: new Date(),
                    channel: channelName,
                    data: ctx.data
                });
            });

            this.subscription.on('subscribing', (ctx) => {
                console.log(`🔄 Subscribing: ${ctx.code} - ${ctx.reason}`);
            });

            this.subscription.on('subscribed', (ctx) => {
                console.log(`✅ Successfully subscribed to ${channelName}`);
                resolve(ctx);
            });

            this.subscription.on('unsubscribed', (ctx) => {
                console.log(`❌ Unsubscribed: ${ctx.code} - ${ctx.reason}`);
            });

            this.subscription.on('error', (ctx) => {
                console.error(`❌ Subscription error: ${ctx.message}`);
                reject(new Error(ctx.message));
            });

            // Set timeout for subscription
            setTimeout(() => {
                reject(new Error('Subscription timeout'));
            }, 5000);

            this.subscription.subscribe();
        });
    }

    async publishMessage(channelName, message) {
        console.log(`\n📤 Publishing message to ${channelName}: "${message}"`);
        
        try {
            const messageData = {
                type: 'new_message',
                message: {
                    id: `test-${Date.now()}`,
                    senderId: 'test-user-123',
                    content: message,
                    timestamp: Date.now(),
                    type: 'text'
                },
                conversationId: channelName.split(':')[1],
                timestamp: Date.now()
            };

            const response = await fetch('https://vixter-react-llyd.vercel.app/api/centrifugo/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: channelName,
                    data: messageData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Publish failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`✅ Message published successfully`);
            return result;
        } catch (error) {
            console.error(`❌ Publish failed: ${error.message}`);
            throw error;
        }
    }

    disconnect() {
        if (this.centrifuge) {
            this.centrifuge.disconnect();
            this.centrifuge = null;
            this.subscription = null;
            console.log(`🔌 Disconnected from Centrifugo`);
        }
    }

    getReceivedMessages() {
        return this.receivedMessages;
    }
}

async function runTest() {
    console.log('🧪 Starting Centrifugo Test Suite\n');
    
    const tester = new CentrifugoTester();
    const testChannel = 'conversation:test-123';
    
    try {
        // Test 1: Connection
        console.log('='.repeat(50));
        console.log('TEST 1: Connection');
        console.log('='.repeat(50));
        await tester.connect('test-user-123');
        
        // Test 2: Subscription
        console.log('\n' + '='.repeat(50));
        console.log('TEST 2: Channel Subscription');
        console.log('='.repeat(50));
        await tester.subscribe(testChannel);
        
        // Test 3: Publishing and Receiving
        console.log('\n' + '='.repeat(50));
        console.log('TEST 3: Message Publishing & Receiving');
        console.log('='.repeat(50));
        
        // Publish a test message
        await tester.publishMessage(testChannel, 'Hello from automated test!');
        
        // Wait a bit to see if we receive our own message
        console.log('\n⏳ Waiting 3 seconds for message reception...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check results
        const receivedMessages = tester.getReceivedMessages();
        console.log(`\n📊 RESULTS: Received ${receivedMessages.length} message(s)`);
        
        if (receivedMessages.length > 0) {
            console.log('✅ SUCCESS: Message was received! The pub/sub flow is working.');
            receivedMessages.forEach((msg, index) => {
                console.log(`   Message ${index + 1}: ${msg.data.message?.content || JSON.stringify(msg.data)}`);
            });
        } else {
            console.log('❌ FAILURE: No messages received. There might be an issue with the pub/sub flow.');
        }
        
        // Test 4: Multiple messages
        console.log('\n' + '='.repeat(50));
        console.log('TEST 4: Multiple Messages');
        console.log('='.repeat(50));
        
        for (let i = 1; i <= 3; i++) {
            await tester.publishMessage(testChannel, `Test message ${i}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalMessages = tester.getReceivedMessages();
        console.log(`\n📊 FINAL RESULTS: Total received ${finalMessages.length} message(s)`);
        
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        console.error('Stack trace:', error.stack);
    } finally {
        tester.disconnect();
        console.log('\n🎯 Test completed');
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = { CentrifugoTester, runTest };
