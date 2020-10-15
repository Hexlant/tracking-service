const express = require('express');
const session = require('express-session')
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const config = require('./config/config');
const pickerAbi = require('./config/pickerABI');
const axios = require('axios');

// init web3
const Web3 = require('web3');
const web3 = new Web3(config.getConfig().httpEndpoint + '/v1/ETH/rpc');

// Contract
const pickerContractAddress = config.getConfig().pickerServiceContractAddress;
const pickerContract = new web3.eth.Contract(pickerAbi, pickerContractAddress);

let app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let token_list = [];
let address;

/*
  Default Route
*/
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  const address = req.param('address');
  const privateKey = req.param('private_key');
  let globalConfig = config.getConfig();
  globalConfig.privateKey = privateKey;
  globalConfig.address = address;
  res.redirect('/');
});

app.get('/api/get_info', async function(req, res) {
  const address = config.getConfig().address;
  const result = await web3.eth.getBalance(address);
  const ether = web3.utils.fromWei(result, 'ether');
  res.json( { balance: ether, address: address});
});

app.get('/api/get_history', async function(req, res) {
  const address = '0x31F7c7BE7219Ec6D30E366B82515ed625cd671Ef';
  const txList = await getTxListByAddress(address);
  res.json(txList);
})

app.get('/api/tracking', async function(req, res) {
  const address = req.query.address;
  const data = await tracking(address);
  res.json(data);
});

async function tracking(targetAddress) {
  let txs = await getTxListByAddress(targetAddress);
  let result = [...txs];
  for (let tx of txs) {
    if (tx.to === targetAddress) continue;
    let recursiveTxs = await tracking(tx.to);
    let tempTxs = [];
    for (let recursiveTx of recursiveTxs) {
      if (recursiveTx.to !== tx.to) {
        tempTxs.push(recursiveTx);
      }
    };

    if (tempTxs.length > 0) {
      result.push(...recursiveTxs);
    }
  }

  return result;
}

async function getTxListByAddress(address) {
  const httpEndpoint = config.getConfig().httpEndpoint;
  const requestUrl = `${httpEndpoint}/v1/ETH/addresses/${address}/transactions`;
  console.log(requestUrl);
  const res = await axios.get(requestUrl, { responseType: 'text' });
  return res.data;
}

module.exports = app;
