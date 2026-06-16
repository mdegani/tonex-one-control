const firebaseConfig = {
    apiKey: 'AIzaSyAPXKYIseWWutXcJS4vZJE_AF1Nm5d4ncs',
    authDomain: 'signal-chain-91e32.firebaseapp.com',
    databaseURL: 'https://signal-chain-91e32-default-rtdb.firebaseio.com',
    projectId: 'signal-chain-91e32',
    storageBucket: 'signal-chain-91e32.firebasestorage.app',
    messagingSenderId: '131855332902',
    appId: '1:131855332902:web:3010130937d14ad74158e7',
};

firebase.initializeApp(firebaseConfig);

const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
const fbRtdb = firebase.database();

fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
