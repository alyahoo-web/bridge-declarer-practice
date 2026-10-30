// ui.js: the Play screen and Result screen for the one-deal Bridge declarer practice app.
(function () {
  'use strict';

  var Bridge = window.Bridge;
  var app = document.getElementById('app');

  // ---------------------------------------------------------------- the fixed deal
  // Intended line: 3NT by South, West leads; take nine top tricks (spade, heart and diamond A-K-Q) plus the club ace, crossing between hands with low cards.
  var DEAL_PBN = 'N:AK42.A53.K63.874 976.T86.T872.QT9 Q53.KQ4.AQ4.A652 JT8.J972.J95.KJ3';
  var CONTRACT = { level: 3, strain: 'NT', doubled: 0, declarer: 'S' };

  var DEFENDER_DELAY = 600;  // ms between a defender's automatic plays
  var RESULT_DELAY = 1200;   // ms to look at the last trick before the Result screen

  var SEAT_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
  var SUIT_SYMBOL = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };
  var SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  var RANK_NAME = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten' };

  var deal = null;
  var game = null;
  var screen = 'play';
  var timer = null;
  var pos = null; // seat on screen: {bottom, left, top, right}

  // ---------------------------------------------------------------- small helpers

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function isRed(suit) { return suit === 'H' || suit === 'D'; }
  function rankLabel(card) { return card.charAt(1) === 'T' ? '10' : card.charAt(1); }
  function cardName(card) {
    var r = card.charAt(1);
    return (RANK_NAME[r] || r) + ' of ' + SUIT_NAME[card.charAt(0)];
  }
  function sideOf(seat) { return Bridge.SEATS.indexOf(seat) % 2 === 0 ? 'NS' : 'EW'; }

  function strainText(strain) {
    return strain === 'NT' ? 'NT' : SUIT_SYMBOL[strain];
  }

  // A card face; a <button> when it can be tapped, otherwise a plain <div> shown in the trick.
  function cardFace(card, tag) {
    var suit = card.charAt(0);
    var node = el(tag, 'card' + (isRed(suit) ? ' red' : ''));
    node.appendChild(el('span', 'rank', rankLabel(card)));
    node.appendChild(el('span', 'suit', SUIT_SYMBOL[suit]));
    node.setAttribute('aria-label', cardName(card));
    return node;
  }

  function setPositions() {
    var d = Bridge.SEATS.indexOf(CONTRACT.declarer);
    pos = {
      bottom: Bridge.SEATS[d],
      left: Bridge.SEATS[(d + 1) % 4],
      top: Bridge.SEATS[(d + 2) % 4],
      right: Bridge.SEATS[(d + 3) % 4]
    };
  }

  // ---------------------------------------------------------------- game flow

  function startGame() {
    clearTimeout(timer);
    timer = null;
    game = Bridge.newGame(deal, CONTRACT);
    screen = 'play';
    render();
    advance();
  }

  // Plays defenders' cards (after a short delay) until it is the user's turn or the game is over.
  function advance() {
    clearTimeout(timer);
    timer = null;
    if (Bridge.isFinished(game)) {
      timer = setTimeout(function () { screen = 'result'; render(); }, RESULT_DELAY);
      return;
    }
    if (Bridge.isUserTurn(game)) return;
    timer = setTimeout(function () {
      game = Bridge.playCard(game, Bridge.randomDefenderCard(game));
      render();
      advance();
    }, DEFENDER_DELAY);
  }

  function onCardTap(card) {
    if (screen !== 'play' || Bridge.isFinished(game) || !Bridge.isUserTurn(game)) return;
    try {
      game = Bridge.playCard(game, card);
    } catch (e) {
      console.error(e);
      render();
      return;
    }
    render();
    advance();
  }

  // ---------------------------------------------------------------- rendering

  function render() {
    app.textContent = '';
    app.appendChild(screen === 'result' ? renderResult() : renderPlay());
  }

  function renderPlay() {
    var root = el('div', 'screen');
    root.appendChild(renderHeader());
    root.appendChild(renderHand(pos.top));
    root.appendChild(renderMiddle());
    root.appendChild(renderStatus());
    root.appendChild(renderHand(pos.bottom));
    return root;
  }

  function renderHeader() {
    var needed = 6 + CONTRACT.level;
    var side = sideOf(CONTRACT.declarer);
    var other = side === 'NS' ? 'EW' : 'NS';
    var header = el('div', 'header');

    var left = el('div', 'contract');
    left.appendChild(document.createTextNode(CONTRACT.level));
    var strain = el('span', isRed(CONTRACT.strain) ? 'redsuit' : '', strainText(CONTRACT.strain));
    left.appendChild(strain);
    if (CONTRACT.doubled) left.appendChild(document.createTextNode(CONTRACT.doubled === 2 ? 'XX' : 'X'));
    left.appendChild(el('small', '', SEAT_NAME[CONTRACT.declarer] + ' declares'));
    header.appendChild(left);

    var right = el('div', 'score');
    var line = el('div');
    line.appendChild(document.createTextNode('Tricks '));
    line.appendChild(el('b', '', String(game.tricksWon[side])));
    line.appendChild(document.createTextNode(' / ' + needed + ' needed'));
    right.appendChild(line);
    right.appendChild(el('small', '', 'Defence has ' + game.tricksWon[other]));
    header.appendChild(right);
    return header;
  }

  function renderHand(seat) {
    var finished = Bridge.isFinished(game);
    var onTurn = !finished && Bridge.isUserTurn(game) && game.toPlay === seat;
    var legal = onTurn ? Bridge.legalPlays(game) : [];
    var role = seat === CONTRACT.declarer ? 'declarer (you)' : 'dummy';

    var hand = el('div', 'hand' + (onTurn ? ' active' : ''));
    hand.appendChild(el('div', 'caption', SEAT_NAME[seat] + ' \u00b7 ' + role + (onTurn ? ' \u00b7 your turn' : '')));
    var cards = el('div', 'cards');
    var sorted = Bridge.sortHand(game.handsRemaining[seat]);
    Bridge.SUITS.forEach(function (suit) {
      var inSuit = sorted.filter(function (c) { return c.charAt(0) === suit; });
      if (inSuit.length === 0) return;
      var group = el('div', 'group');
      inSuit.forEach(function (card) {
        var btn = cardFace(card, 'button');
        btn.type = 'button';
        var ok = legal.indexOf(card) >= 0;
        btn.disabled = !ok;
        if (onTurn && !ok) btn.className += ' illegal';
        if (ok) btn.addEventListener('click', function () { onCardTap(card); });
        group.appendChild(btn);
      });
      cards.appendChild(group);
    });
    hand.appendChild(cards);
    return hand;
  }

  function renderDefender(seat) {
    var thinking = !Bridge.isFinished(game) && game.toPlay === seat;
    var box = el('div', 'defender' + (thinking ? ' thinking' : ''));
    box.appendChild(el('div', 'caption', SEAT_NAME[seat]));
    var back = el('div', 'card back', String(game.handsRemaining[seat].length));
    back.setAttribute('aria-label', SEAT_NAME[seat] + ' has ' + game.handsRemaining[seat].length + ' cards');
    box.appendChild(back);
    return box;
  }

  function renderMiddle() {
    var row = el('div', 'middle');
    row.appendChild(renderDefender(pos.left));
    row.appendChild(renderTrick());
    row.appendChild(renderDefender(pos.right));
    return row;
  }

  // Shows the trick in play, or the last completed trick (with its winner marked) until the next card is played.
  function renderTrick() {
    var wrap = el('div', 'trickwrap');
    var trick = game.currentTrick;
    var done = false;
    if (trick.length === 0 && game.completedTricks.length > 0) {
      trick = game.completedTricks[game.completedTricks.length - 1];
      done = true;
    }
    var winner = done ? Bridge.trickWinner(trick, CONTRACT.strain) : null;
    var grid = el('div', 'trick' + (done ? ' done' : ''));
    var posOfSeat = {};
    Object.keys(pos).forEach(function (p) { posOfSeat[pos[p]] = p; });
    trick.forEach(function (play) {
      var face = cardFace(play.card, 'div');
      face.className += ' slot-' + posOfSeat[play.seat] + (play.seat === winner ? ' winner' : '');
      grid.appendChild(face);
    });
    wrap.appendChild(grid);
    wrap.appendChild(el('div', 'trickinfo', done ? 'Last trick won by ' + SEAT_NAME[winner] : ''));
    return wrap;
  }

  function renderStatus() {
    var text;
    var go = false;
    if (Bridge.isFinished(game)) {
      text = 'All 13 tricks played';
    } else if (Bridge.isUserTurn(game)) {
      var seat = game.toPlay;
      text = (game.currentTrick.length === 0 ? 'Lead from ' : 'Play from ') + SEAT_NAME[seat] +
        (seat === CONTRACT.declarer ? ' (your hand)' : ' (dummy)');
      go = true;
    } else {
      text = SEAT_NAME[game.toPlay] + ' is playing\u2026';
    }
    return el('div', 'status' + (go ? ' go' : ''), text);
  }

  function renderResult() {
    var result = Bridge.getResult(game);
    var root = el('div', 'screen result');
    root.appendChild(el('div', 'verdict ' + (result.made ? 'made' : 'failed'),
      result.made ? 'Contract made' : 'Contract failed'));
    var tally = el('div', 'tally');
    tally.appendChild(document.createTextNode(result.tricksTaken + ' tricks taken, ' + result.tricksNeeded + ' needed'));
    var diff = result.tricksTaken - result.tricksNeeded;
    tally.appendChild(el('small', '', CONTRACT.level + strainText(CONTRACT.strain) + ' by ' +
      SEAT_NAME[CONTRACT.declarer] + (diff > 0 ? ' made with ' + diff + ' overtrick' + (diff > 1 ? 's' : '')
        : diff === 0 ? ' made exactly' : ' went down ' + (-diff))));
    root.appendChild(tally);
    var again = el('button', 'again', 'Play again');
    again.type = 'button';
    again.addEventListener('click', startGame);
    root.appendChild(again);
    return root;
  }

  // ---------------------------------------------------------------- start

  try {
    ['parsePBNDeal', 'sortHand', 'SEATS', 'SUITS', 'newGame', 'legalPlays', 'playCard', 'isFinished',
      'getResult', 'isUserTurn', 'trickWinner', 'randomDefenderCard'].forEach(function (name) {
      if (!Bridge || !Bridge[name]) throw new Error('Bridge.' + name + ' is missing: check that cards.js, rules.js and ai.js load before ui.js');
    });
    deal = Bridge.parsePBNDeal(DEAL_PBN); // throws unless 4 hands of 13 and all 52 cards appear once
    setPositions();
    startGame();
  } catch (e) {
    app.textContent = '';
    app.appendChild(el('div', 'fatal', 'Could not start: ' + e.message));
    throw e;
  }
})();
