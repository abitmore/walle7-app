var numbers = require('../utils/numbers');
var settings = require('../utils/settings');
var app = require('../app');

var kjua = require('kjua');
var {Apis} = require('bitsharesjs-ws');
var {TransactionBuilder, TransactionHelper, Aes} = require('bitsharesjs');


module.exports = {
	main: async function(arg) {
	    console.log('main');

	    if (Object.keys(settings.balances).length == 0) {
		await app.changeView('multi-view-modal-show', {
		    modalName: 'modalWithdrawCoins',
		    viewName: 'firstdeposit'
		});
		
		return false;
	    }

	    $('#modalWithdrawCoins [data-coin-search]').unbind('keyup.mwallets').bind('keyup.mwallets', function() {
		var value = $(this).val().toLowerCase();

		$('#modalWithdrawCoins [data-coins-list] li').filter(function() {
		    $(this).toggle(
			$(this).find('[data-symbol]').text().toLowerCase().indexOf(value) > -1 ||
			$(this).find('[data-name]').text().toLowerCase().indexOf(value) > -1
		    );
		});
	    
		$('#modalWithdrawCoins [data-coin-search-empty]').toggle(
		    !$('#modalWithdrawCoins [data-coins-list] li:visible').length
		);
		//$('#coin-search-unsupported').toggle(!value.length);
		$('#modalWithdrawCoins .areaClear').toggleClass('active', value.length > 0);
	    });

	    $('#modalWithdrawCoins .areaClear').unbind('click.mwallets').bind('click.mwallets', function() {
		$('#modalWithdrawCoins [data-coin-search]').val('');
		$('#modalWithdrawCoins [data-coin-search]').trigger('keyup');
	    });

	    $('#modalWithdrawCoins [data-coins-list]').empty();

	    var sortedAssets = [];
	    for (var assetId in settings.assets) {
		sortedAssets.push({
		    usdAmount: settings.balances[assetId]
			? settings.balances[assetId].usdAmount
			: 0,
		    amount: settings.balances[assetId]
			? settings.balances[assetId].amount
			: 0,
		    volume24h: settings.pulse[assetId].pulse.volume_24h,
		    id: assetId
		});
	    }

	    sortedAssets.sort(function(a, b) {
		//console.log(b.usdAmount - a.usdAmount);
		return b.usdAmount - a.usdAmount || b.volume24h - a.volume24h;
	    });

	    for (var asset of sortedAssets) {
		var amount = numbers.shortenNumber(asset.amount);
		var usdAmount = numbers.shortenNumber(asset.usdAmount);

		if (amount == 0) {
		    continue;
		}

		var data = {
		    name: settings.assets[asset.id].name,
	    	    symbol: settings.assets[asset.id].symbol,
	    	    amount: amount,
	    	    'usd-amount': usdAmount
		};

		var div = $('#modalWithdrawCoins [data-coin-template] > li').clone();

		for (var k in data) {
		    div.find('[data-' + k + ']').text(data[k]);
		}

		div.attr('data-modal-arg', asset.id);
		div.addClass('c-' + asset.id);
	    
		div.appendTo('#modalWithdrawCoins [data-coins-list]');
	    }

	    app.setHandlers();

	    $('#modalWithdrawCoins [data-coin-search]').val('');
	    $('#modalWithdrawCoins [data-coin-search]').trigger('keyup');
	},
	
	selectWallet: async function(arg) {
	    console.log('selectWallet');
	    
	    var sortedWalletsBalances = [];
	    for (var id in settings.assets[arg].wallets) {
		var btsId = settings.assets[arg].wallets[id].btsId;

		sortedWalletsBalances.push({
		    amount: settings.balances[arg] && settings.balances[arg].wallets[btsId]
			? settings.balances[arg].wallets[btsId].amount
			: 0,
		    id: id
		});
	    }

	    if (sortedWalletsBalances.length == 1) {
		await app.changeView('multi-view-modal-show', {
		    modalName: 'modalWithdrawCoins',
		    viewName: 'withdraw'
		}, JSON.stringify({
		    assetId: arg,
		    walletId: sortedWalletsBalances[0].id
		}));
		
		return false;
	    }

	    sortedWalletsBalances.sort(function(a, b) {
		return b.amount - a.amount;
    	    });

	    $('#modalWithdrawCoins [data-wallets]').empty();
	    $('#modalWithdrawCoins [data-symbol]').text(settings.assets[arg].symbol);
	
	    for (var wallet of sortedWalletsBalances) {
		if (wallet.amount == 0) {
		    continue;
		}
		
		var div = $('#modalWithdrawCoins [data-wallet-template] > li').clone();
		var usdAmount = numbers.shortenNumber(wallet.amount * settings.pulse[arg].pulse.price);
		wallet.amount = numbers.shortenNumber(wallet.amount);

		div.attr('data-modal-arg', JSON.stringify({
		    assetId: arg,
		    walletId: wallet.id
		}));
		div.find('[data-name]').text(settings.exchanges[wallet.id].name);
		div.find('[data-amount]').text(wallet.amount);
		div.find('[data-usd-amount]').text(usdAmount);
	    
		div.appendTo('#modalWithdrawCoins [data-wallets]');
	    }

	    app.setHandlers();
	},

	withdraw: async function(arg) {
try{
	    arg = JSON.parse(arg);
	    console.log(arg);

	    var asset = settings.assets[arg.assetId];
	    var btsId = settings.assets[arg.assetId].wallets[arg.walletId].btsId;

	    var data = {
		'name': asset.name,
		'symbol': asset.symbol
	    }

	    $('#modalWithdrawCoins [data-id]')
		.removeClass()
		.addClass('c-' + arg.assetId);

	    if (settings.balances[arg.assetId] && settings.balances[arg.assetId].wallets[btsId]) {
		data['balance'] = numbers.toFixed(settings.balances[arg.assetId].wallets[btsId].amount);
		data['usd-balance'] = numbers.shortenNumber(settings.balances[arg.assetId].wallets[btsId].amount * settings.pulse[arg.assetId].pulse.price);
	    } else {
		data['balance'] = 0;
		data['usd-balance'] = 0;
	    }

	    $('#modalWithdrawCoins [data-amount-input]').unbind('keyup.wdraw').bind('keyup.wdraw', function() {
		$('#modalWithdrawCoins [data-usd-amount]').text(
		    numbers.floatify($(this).val() * settings.pulse[arg.assetId].pulse.price, 2)
		);
	    });

	    if (!arg.edit) {
		$('#modalWithdrawCoins [data-amount-input]').val('');
		$('#modalWithdrawCoins [data-address-input]').val('');
		$('#modalWithdrawCoins [data-amount-input]').trigger('keyup');
	    }

	    $('#modalWithdrawCoins [data-min-amount]').unbind('click.wdraw').bind('click.wdraw', function() {
		$('#modalWithdrawCoins [data-amount-input]').val(
		    $('#modalWithdrawCoins [data-min-amount]').text()
		);
		
		$('#modalWithdrawCoins [data-amount-input]').trigger('keyup');
	    });

	    $('#modalWithdrawCoins [data-max-amount]').unbind('click.wdraw').bind('click.wdraw', function() {
		$('#modalWithdrawCoins [data-amount-input]').val(
		    $('#modalWithdrawCoins [data-max-amount]').text()
		);
		
		$('#modalWithdrawCoins [data-amount-input]').trigger('keyup');
	    });

	    $('#modalWithdrawCoins [data-view="withdraw"] [data-modal-arg]').attr('data-modal-arg', JSON.stringify(arg));

	    var fees = await Apis.instance().db_api().exec('get_objects', [['2.0.0']]);
	    var cer = await Apis.instance().db_api().exec('lookup_asset_symbols', [[btsId]]);
	    var userAcc = await Apis.instance().db_api().exec('get_full_accounts', [[settings.user.id], true]);

	    var fee = cer[0].options.core_exchange_rate.quote.amount /
		cer[0].options.core_exchange_rate.base.amount;

	    if (arg.assetId == 9) {
		fee = (fees[0].parameters.current_fees.parameters[0][1].fee) *
		    fee / 10 ** cer[0].precision;
		fee = fee.toFixed(cer[0].precision);

		data['min-amount'] = fee;

		if (settings.balances[arg.assetId] && settings.balances[arg.assetId].wallets[btsId]) {
		    data['max-amount'] = numbers.floatify(settings.balances[arg.assetId].wallets[btsId].amount - fee, 5);
		} else {
		    data['max-amount'] = 0;
		}
		data['service-fee'] = fee;
		data['usd-service-fee'] = numbers.floatify(fee * settings.pulse[arg.assetId].pulse.price, 2);
	    } else {
		fee = (fees[0].parameters.current_fees.parameters[0][1].fee +
		    fees[0].parameters.current_fees.parameters[0][1].price_per_kbyte * 0.2) *
		    fee / 10 ** cer[0].precision;
		fee = fee.toFixed(cer[0].precision);

		var trade = await $.ajax({
		    url: app.gws[arg.walletId].BASE + '/simple-api/initiate-trade',
		    contentType: 'application/json',
		    type: 'POST',
		    data: JSON.stringify({
			inputCoinType: arg.walletId == '3' ? asset.wallets[arg.walletId].btsSymbol.toLowerCase() : asset.symbol.toLowerCase(),
	    		outputAddress: settings.user.name,
			outputCoinType: asset.wallets[arg.walletId].btsSymbol.toLowerCase()
		    }),
		    dataType: 'json'
		});

		var r = await $.ajax({
		    url: app.gws[arg.walletId].BASE + app.gws[arg.walletId].COINS_LIST,
		    contentType: 'application/json',
		    dataType: 'json'
		});
		//console.log(r);

		var coins_by_type = {};
		if (arg.walletId == 3) {
		    for (var coin of r) {
			coins_by_type[coin.backingCoinType] = coin;
		    }
		}
	
		for (var coin of r) {
		    coins_by_type[coin.coinType] = coin;
		}
		console.log(coins_by_type);
	
		var backedCoins = [];
		for (var inputCoin of r) {
		    var outputCoin = coins_by_type[inputCoin.backingCoinType];
	    
		    if (/*!inputCoin.walletSymbol.startsWith(backer + ".") ||*/
			!inputCoin.backingCoinType ||
	    		!outputCoin) {
	    		continue;
		    }

		    backedCoins.push({
            		name: outputCoin.name,
            		gateFee: outputCoin.gateFee || outputCoin.transactionFee,
            		backingCoinType: arg.walletId == 3
                	    ? inputCoin.backingCoinType.toUpperCase()
                	    : outputCoin.walletSymbol,
            		minAmount: outputCoin.minAmount || 0,
            		maxAmount: outputCoin.maxAmount || 999999999,
            		symbol: inputCoin.walletSymbol,
            		intermediateAccount: arg.walletId == '3' ? 'cryptobridge' : outputCoin.intermediateAccount,
            		//precision: outputCoin.precision,
            		supportsMemos: outputCoin.supportsOutputMemos/*,
            		depositAllowed: isDepositAllowed,
            		withdrawalAllowed: isWithdrawalAllowed*/
        	    });
		}
		console.log(backedCoins);

		var coin = null;
		for (var item of backedCoins) {//console.log(item.backingCoinType + ' '+trade.outputCoinType);
		    if ( item.symbol.toLowerCase() == trade.outputCoinType) {
			coin = item;
			break;
		    }
		}
		console.log(coin);

    		/*var minDeposit = 0;
    		if (!!coin) {
    		    if (!!coin.minAmount && !!coin.precision) {
    			minDeposit = coin.minAmount / 10 ** coin.precision;
    		    } else if (!!coin.gateFee) {
    			minDeposit = coin.gateFee * 2;
    		    }
    		}*/


		var serviceFee = numbers.floatify(parseFloat(coin.gateFee) + parseFloat(fee), 5);
		data['min-amount'] = serviceFee;

		if (settings.balances[arg.assetId] && settings.balances[arg.assetId].wallets[btsId]) {
		    data['max-amount'] = numbers.floatify(settings.balances[arg.assetId].wallets[btsId].amount - serviceFee, 5);
		} else {
		    data['max-amount'] = 0;
		}
		data['service-fee'] = serviceFee;
		data['usd-service-fee'] = numbers.floatify(serviceFee * settings.pulse[arg.assetId].pulse.price, 2);
	    }


	    for (var k in data) {
		$('#modalWithdrawCoins [data-' + k + ']').text(data[k]);
	    }

	    if (data.balance <= data['service-fee']) {
		await app.changeView('multi-view-modal-show', {
		    modalName: 'modalWithdrawCoins',
		    viewName: 'insufficient'
		});

		return false;
	    }
}catch(e){console.log(e);}
	    
	    this.prepareTransaction = async () => {
try{
		var k = app.generateKeyFromPassword(userAcc[0][1].account.name, 'memo', settings.user.password);
		var k2 = app.generateKeyFromPassword(userAcc[0][1].account.name, 'active', settings.user.password);

		if (arg.assetId == 9) {
		    var dexAcc = await Apis.instance().db_api().exec('get_full_accounts', [[$('#modalWithdrawCoins [data-address-input]').val()], true]);

		    var op = [0, {
			fee: {
			    amount: fee * 10 ** cer[0].precision,
			    asset_id: btsId
			},
			from: userAcc[0][1].account.id,
			to: dexAcc[0][1].account.id,
			amount: {
			    amount: (parseFloat($('#modalWithdrawCoins [data-amount-input]').val()) * 10 ** asset.wallets[arg.walletId].btsPrecision).toFixed(),
			    asset_id: btsId
			}
		    }];
		} else {
		    var dexAcc = await Apis.instance().db_api().exec('get_full_accounts', [[coin.intermediateAccount], true]);

		    console.log('gate fee: ' + coin.gateFee);

		    var op = [0, {
			fee: {
			    amount: fee * 10 ** cer[0].precision,
			    asset_id: btsId
			},
			from: userAcc[0][1].account.id,
			to: dexAcc[0][1].account.id,
			amount: {
			    amount: ((parseFloat($('#modalWithdrawCoins [data-amount-input]').val()) + parseFloat(coin.gateFee)) * 10 ** asset.wallets[arg.walletId].btsPrecision).toFixed(),
			    asset_id: btsId
			},
			memo: {
			    from: userAcc[0][1].account.options.memo_key,
			    to: dexAcc[0][1].account.options.memo_key,
			    nonce: TransactionHelper.unique_nonce_uint64(),
			    message: (arg.walletId == '3' ? asset.wallets[arg.walletId].btsSymbol.toLowerCase() : asset.symbol.toLowerCase()) +
				':' + $('#modalWithdrawCoins [data-address-input]').val()
			}
		    }];

		    console.log(op[1].memo.message);

		    var m = Aes.encrypt_with_checksum(
        		k.privKey,
            		op[1].memo.to,
            		op[1].memo.nonce,
            		op[1].memo.message
        	    );
	
		    op[1].memo.message = m;
		    console.log(m.toString('hex'));
		}
		//console.log(op);

		var trx = new TransactionBuilder();
		trx.add_operation(op);
		trx.add_signer(k2.privKey, k2.pubKey);

		return trx;
}catch(e) {console.log(e);}
	    }
	},

	confirm: async function(arg) {
	    console.log(arg);

	    arg = JSON.parse(arg);

	    $('#modalWithdrawCoins [data-address-copy-button]')
		.unbind('click.withdraw')
		.bind('click.withdraw', copyAddress);

	    function copyAddress() {
		$('#modalWithdrawCoins [data-address-copy-button]').addClass('active');
		setTimeout(function() {
		    $('#modalWithdrawCoins [data-address-copy-button]').removeClass('active');
		}, 2000);

		$('#modalWithdrawCoins [data-address-input2]').focus();
		$('#modalWithdrawCoins [data-address-input2]').select();

		try {
	    	    document.execCommand('copy');
	    	    window.getSelection().removeAllRanges();
		} catch (e) { }
	    }

	    var el = kjua({
		text: $('#modalWithdrawCoins [data-address-input2]').val(),
		size: 210,
		fill: '#000',
		background: '#fff'
	    });

	    $('#modalWithdrawCoins [data-address-input2]').val(
		$('#modalWithdrawCoins [data-address-input]').val()
	    );

	    $('#modalWithdrawCoins [data-address-qr]').attr('src', el.src);

	    $('#modalWithdrawCoins [data-amount]').text(
		$('#modalWithdrawCoins [data-amount-input]').val()
	    );

	    $('#modalWithdrawCoins [data-address]').text(
		$('#modalWithdrawCoins [data-address-input]').val()
	    );

	    $('#modalWithdrawCoins [data-explorer]').attr('href',
		settings.assets[arg.assetId].info.explorer[0]
	    );

	    arg.edit = true;
	    $('#modalWithdrawCoins [data-view-show2="withdraw"]').attr('data-modal-arg', JSON.stringify(arg));

	    var prepareTransaction = this.prepareTransaction;

	    $('#modalWithdrawCoins [data-withdraw-button]').unbind('click.wdraw').bind('click.wdraw', async function() {

		try {
		    $('#modalWithdrawCoins .preloader').addClass('active');

		    var trx = await prepareTransaction();
		    console.log(trx);

		    var r = await trx.broadcast();
		    console.log(r);

		    await app.updateBalances();
		    app.renderBalances();
	    
		    await app.updateHistory();
		    app.renderHistory();
	    
		    await app.modalHandler({modalName: 'modalCoin'}, arg.assetId);
	    
		    app.setHandlers();

		    await app.changeView('multi-view-modal-show', {
			modalName: 'modalWithdrawCoins',
			viewName: 'success'
		    });
		
		    return false;
		} catch (e) {
		    await app.changeView('multi-view-modal-show', {
			modalName: 'modalWithdrawCoins',
			viewName: 'fail'
		    });
		
		    return false;
		}
	    });
	}
}