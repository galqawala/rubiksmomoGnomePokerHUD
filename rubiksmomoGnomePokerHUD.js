#!/usr/bin/gjs

/*
    https://people.gnome.org/~gcampagna/docs/
    https://wibblystuff.blogspot.fi/2015/05/first-time-for-everything-gnome.html
*/

const Lang      =   imports.lang;
const Gtk       =   imports.gi.Gtk;
const Gdk       =   imports.gi.Gdk;
const GLib      =   imports.gi.GLib;
const Gio       =   imports.gi.Gio;
const WebKit2   =   imports.gi.WebKit2;

var globalData                  = new Data();
//path of the hud directory
var hudPath                     = GLib.get_home_dir()+"/rubiksmomoGnomePokerHUD";
//path of the hand history root, that contains a directory for each player name
var handHistoryPath             = GLib.get_home_dir()+"/PlayOnLinux's virtual drives/pokerStars2016/drive_c/Program Files/PokerStars.EU/HandHistory";
//var handHistoryPath             = GLib.get_home_dir()+"/HandHistoryTest";

function Data() {
    this.windowLayout                           =   [   
        ["bb","hands","vpip","pfr"]
    ,   ["preflop3bet","ats","bbfvs","wtsd"]
    ,   ["title_notes_range_preflop",   "notes_range_preflop"   ]
    ,   ["title_notes_range_flop",      "notes_range_flop"      ]
    ,   ["title_notes_range_turn",      "notes_range_turn"      ]
    ,   ["title_notes_range_river",     "notes_range_river"     ]
    ];
    this.heroWindowLayout                       =   [["bb","icmNash","hands","vpip","pfr"],["preflop3bet","ats","bbfvs","wtsd"]];
    this.processHandsUntilNo                    =   0;   //Wanna see stats at some specific point in past? Use 0 to process all.
    this.refreshIntervalMilliseconds            =   4000;
    this.maxHands                               =   500;    //If player has more than this many hands in history, the most relevant this many hands are used to calculate the stats. 
    this.dateTimeFormat                         =   "%F %T"
    this.hero                                   =   "";
    this.latestHandNumber                       =   0;
    this.handNumberBeingProcessed               =   0;
    this.seatsPickedFromHand                    =   0;
    this.seatOfHero                             =   0;
    this.seatOfButton                           =   0;
    this.players                                =   [];
    this.realMoneyLatestHand                    =   true;
    this.playersByHand                          =   [];
    this.atsOpportunity                         =   true;
    this.playersLeftToAct                       =   0;
    this.maxPlayers                             =   0;
    this.windowPositions                        =   [];
    this.facingSteal                            =   0;
    this.raisesInCurrentStreet                  =   0;
    this.ante                                   =   0;
    this.smallBlind                             =   0;
    this.bigBlind                               =   0;
    this.playerNameOnUTG                        =   "";
    this.chipsPutIntoPotByPlayerOnLatestStreet  =   [];
    this.section                                =   "";
    this.icmNashChart                           =   undefined;
    this.priceStructure                         =   "";
    this.completedHistoryFiles                  =   [];
    this.lastLineProcessedByFile                =   [];
    this.timeFromHandBeingProcessed             =   new Date(0);
    this.timeFromOldestHand                     =   new Date();
    this.timeFromNewestHand                     =   new Date(0);
    this.handRank                               =    ["AA","KK","QQ","AKs","JJ","AQs","KQs","AJs","KJs","TT","AKo","ATs","QJs","KTs","QTs","JTs","99","AQo","A9s","KQo","88","K9s","T9s","A8s","Q9s","J9s","AJo","A5s","77","A7s","KJo","A4s","A3s","A6s","QJo","66","K8s","T8s","A2s","98s","J8s","ATo","Q8s","K7s","KTo","55","JTo","87s","QTo","44","33","22","K6s","97s","K5s","76s","T7s","K4s","K3s","K2s","Q7s","86s","65s","J7s","54s","Q6s","75s","96s","Q5s","64s","Q4s","Q3s","T9o","T6s","Q2s","A9o","53s","85s","J6s","J9o","K9o","J5s","Q9o","43s","74s","J4s","J3s","95s","J2s","63s","A8o","52s","T5s","84s","T4s","T3s","42s","T2s","98o","T8o","A5o","A7o","73s","A4o","32s","94s","93s","J8o","A3o","62s","92s","K8o","A6o","87o","Q8o","83s","A2o","82s","97o","72s","76o","K7o","65o","T7o","K6o","86o","54o","K5o","J7o","75o","Q7o","K4o","K3o","96o","K2o","64o","Q6o","53o","85o","T6o","Q5o","43o","Q4o","Q3o","74o","Q2o","J6o","63o","J5o","95o","52o","J4o","J3o","42o","J2o","84o","T5o","T4o","32o","T3o","73o","T2o","62o","94o","93o","92o","83o","82o","72o"];
}

function WindowPosition(maxPlayers,positionInRelationToHero,x,y,width,height,gravity) {
    this.maxPlayers                 =   parseInt(maxPlayers);
    this.positionInRelationToHero   =   parseInt(positionInRelationToHero);
    this.x                          =   parseInt(x);
    this.y                          =   parseInt(y);
    this.width                      =   parseInt(width);
    this.height                     =   parseInt(height);
    this.gravity                    =   parseInt(gravity);
}

function PlayerData(playerName) {
    this.playerName                     =   playerName;
    this.seat                           =   0;
    this.stackSizeInChips               =   0;
    this.stats                          =   [];
    this.leastRelevantHandUsedInStats   =   "";
}

function Stats(hands,realMoney,handNumber,time) {
    //Used to store stats about single hand and totals of multiple hands. Each stat/property indicates number of such hands, unless otherwise commented.
    this.handNumber                 =   handNumber;
    this.hands                      =   hands;
    this.realMoney                  =   realMoney; //boolean (only for single hand)
    this.time                       =   time;
    this.relevanceScore             =   0.000;
    this.vpip                       =   0;
    this.pfr                        =   0;
    this.atsOpportunity             =   0;
    this.ats                        =   0;
    this.bbFacingSteal              =   0;
    this.bbFoldVsSteal              =   0;
    this.wentToFlop                 =   0;
    this.postflopShowdown           =   0;
    this.preflop3betOpportunity     =   0;
    this.preflop3bet                =   0;
}

const rubiksmomoGnomePokerHUD = new Lang.Class({
    Name: 'rubiksmomoGnomePokerHUD',

    _init: function() {
        this.application = new Gtk.Application();
        this.application.connect('activate', Lang.bind(this, this._onActivate));
        this.application.connect('startup',  Lang.bind(this, this._onStartup));
    }
    ,
    _onActivate: function(){
    }
    ,
    _onStartup: function() {
        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_path(hudPath+"/rubiksmomoGnomePokerHUD.css");
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProvider, 400);
        
        loadData();
        refreshHud();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, globalData.refreshIntervalMilliseconds, refreshHud);
        Gtk.main();
    }
});

let app = new rubiksmomoGnomePokerHUD();
app.application.run(ARGV);

function refreshHud() {
    refreshStats();
    drawPlayerWindows();
    saveData();
    return true;
}

function refreshStats() {
    let handDirectory           = Gio.File.new_for_path(handHistoryPath);
    let playerHandDirectories   = handDirectory.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    
    while (true) {
        //loop hand history files
        let playerHandDirectoryInfo = playerHandDirectories.next_file(null);
        if (playerHandDirectoryInfo == null) { break; }
        let playerHandDirectory = handDirectory.get_child(playerHandDirectoryInfo.get_name());

        let playerHandFiles = playerHandDirectory.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        while (true) {
            //loop hand history files
            let fileInfo = playerHandFiles.next_file(null);
            if (fileInfo == null) { break; }
            let file = playerHandFiles.get_child(fileInfo);

            if (!fileInfo.get_name().endsWith("~") && globalData.completedHistoryFiles.indexOf(fileInfo.get_name()) < 0) {
                //Process files without ~ filename suffix
                let fileContent = file.read(null).read_bytes(1000000,null).get_data() + "";
                let lines = fileContent.split("\n");
                getStatsFromHistoryLines(lines, playerHandDirectoryInfo.get_name(), !( / Play Money /.test(fileInfo.get_name()) ), fileInfo.get_name() );
            }
        }
    }
}

function getStatsFromHistoryLines(lines, heroName, realMoney, historyFileName) {
    //Continue reading from the last line we read during last pass.
    let lineNumber   = globalData.lastLineProcessedByFile[historyFileName];
    if (isNaN(lineNumber)) { lineNumber = 0; }
    
    /*  Simplified example: Let's say we read 2 lines first time. Line 0 had content and line 1 was empty. Length needs to be more than 2 before we should read more (starting from line 1). 
        Line 1 was initially empty, but may have content now. PokerStars adds a line break after writing content, but not before. */
    if (lines.length > lineNumber+1) { 
        for (; lineNumber < lines.length; lineNumber++) {
            let playerName = getPlayerNameFromLine(lines[lineNumber]);
            if (globalData.players[playerName] === undefined) {
                globalData.players[playerName] = new PlayerData(playerName);
            }
        
            //loop lines in hand history file
            if ( /PokerStars Hand #/.test(lines[lineNumber]) ) {
                processHandLine(lines[lineNumber],heroName);
            }
            if ( parseInt(globalData.processHandsUntilNo) <= parseInt(0) || parseInt(globalData.handNumberBeingProcessed) <= parseInt(globalData.processHandsUntilNo) ) {
                if ( /^Seat /.test(lines[lineNumber]) && globalData.section != "SUMMARY") {
                    processHandSeatLine(lines[lineNumber], playerName, realMoney);
                } else if ( /Uncalled bet \(\d+\) returned to /.test(lines[lineNumber]) && parseInt(globalData.handNumberBeingProcessed) == parseInt(globalData.latestHandNumber)) {
                    let amount = getAmountFromLine(lines[lineNumber]);
                    globalData.players[playerName].stackSizeInChips += parseInt(amount);
                } else if ( / collected \d+ from pot/.test(lines[lineNumber]) && parseInt(globalData.handNumberBeingProcessed) == parseInt(globalData.latestHandNumber)) {
                    let amount = getAmountFromLine(lines[lineNumber]);
                    globalData.players[playerName].stackSizeInChips += parseInt(amount);
                } else if ( /\*\*\* /.test(lines[lineNumber])) {
                    globalData.section     = lines[lineNumber].split(/\*\*\*/)[1].trim();
                    if (globalData.section=="HOLE CARDS") {
                        globalData.atsOpportunity   =   true;
                    } else {
                        globalData.atsOpportunity   =   false;                
                        globalData.chipsPutIntoPotByPlayerOnLatestStreet   =   [];
                    }
                    globalData.playersLeftToAct             =   globalData.playersByHand[parseInt(globalData.handNumberBeingProcessed)].length;
                    globalData.facingSteal                  =   0;
                    globalData.raisesInCurrentStreet        =   0;
                } else if (/^Table /.test(lines[lineNumber]) && globalData.section == "PokerStars Hand") {
                    processTableLine(lines[lineNumber], globalData.handNumberBeingProcessed, realMoney);
                } else if ( /: posts (the ante|small blind|big blind) \d+/.test(lines[lineNumber]) && parseInt(globalData.handNumberBeingProcessed) == parseInt(globalData.latestHandNumber)) {
                    processAnteOrBlindLine(lines[lineNumber], playerName);
                } else if (/\: (checks|calls|bets|raises|folds) /.test(lines[lineNumber])) {
                    processActionLine(lines[lineNumber], playerName, globalData.handNumberBeingProcessed);
                } else if (/( finished the tournament in | wins the tournament and receives )/.test(lines[lineNumber])) {
                    playerEliminated(playerName, heroName, historyFileName);
                } else if (globalData.section == "SHOW DOWN" && /\: (mucks|shows) (hand|\[[2-9TJQKA][cdhs] [2-9TJQKA][cdhs]\])/.test(lines[lineNumber]) 
                    && globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].wentToFlop == 1) {
                    
                    //went to showdown post flop
                    globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].postflopShowdown = 1;    
                }
            }
        }
    
        globalData.lastLineProcessedByFile[historyFileName] = lineNumber-1;
        let timeSinceLastHand = new Date() - globalData.timeFromHandBeingProcessed;
        if (timeSinceLastHand > 1000*60*60) {
            globalData.completedHistoryFiles.push(historyFileName);
        }
    }
}

function processHandLine(line,heroName) {
    globalData.section      =   "PokerStars Hand";
    globalData.wentToFlop   =   false;
    globalData.chipsPutIntoPotByPlayerOnLatestStreet   =   [];
    
    //extract time
    globalData.timeFromHandBeingProcessed = new Date( /\d{4}\/\d{2}\/\d{2} \d{1,2}\:\d{1,2}\:\d{1,2}/.exec(line)[0] );
    if (globalData.timeFromNewestHand < globalData.timeFromHandBeingProcessed) {
        globalData.timeFromNewestHand = globalData.timeFromHandBeingProcessed;
    }
    if (globalData.timeFromOldestHand > globalData.timeFromHandBeingProcessed) {
        globalData.timeFromOldestHand = globalData.timeFromHandBeingProcessed;
    }

    //get hand number (we'll show stats for the players that were present in last hand)
    globalData.handNumberBeingProcessed = parseInt(line.split(":")[0].split("#")[1]);
    if (    parseInt(globalData.handNumberBeingProcessed) > parseInt(globalData.latestHandNumber) 
        && (parseInt(globalData.processHandsUntilNo) <= parseInt(0) || parseInt(globalData.handNumberBeingProcessed) <= parseInt(globalData.processHandsUntilNo)) ) {
        //newest hand so far
        globalData.latestHandNumber =   parseInt(globalData.handNumberBeingProcessed);
        globalData.hero             =   heroName;
        globalData.playerNameOnUTG  =   "";
        globalData.ante             =   0;  //reset ante to 0 in case it's from an earlier table
        globalData.priceStructure   =   "1";  //winner takes it all
        if ( / Level /.test(line) ) {
            globalData.priceStructure   =   "1.99%2C1.18%2C0.79";  //structure (separator is %2C)
        }
        storeHandNotes(parseInt(globalData.handNumberBeingProcessed));
    }
}

function storeHandNotes(handNumber) {
    let notes = "HAND: "+handNumber;
    for (var windowNo in app.application.get_windows()) {
        let window      = app.application.get_windows()[windowNo];
        let playerName  = window.get_title().substr(3);
        let vbox        = window.get_children()[0];
        notes += "\n\nPLAYER: "+playerName+"\n";
        
        for (var hboxNo in vbox.get_children()) {
            for (var widgetNo in vbox.get_children()[hboxNo].get_children()) {
                let widget = vbox.get_children()[hboxNo].get_children()[widgetNo];
                let widgetName = getWindowLayout(playerName)[hboxNo][widgetNo];
                if (typeof widget.get_buffer === 'function' && !(/^title_/.test(widgetName)) ) {
                    let widgetText = widgetGetText(widget);
                    if (/[^\s\.]/.test(widgetText) ) {
                        notes += "\n\t"+widgetName+": "+widgetText.trim();
                    }
                }
                if (/^notes_/.test(widgetName)) {
                    widgetSetText(widget,"...");   
                }
            }
        }
    }
    if (/\snotes_/.test(notes)) {
        saveFile("notes/hand"+handNumber,notes);
    }
}

function processActionLine(line, playerName, handNumber) {
    //handle all actions
    if (globalData.section=="HOLE CARDS") {
        processPreflopAction(line, handNumber, playerName, globalData.section);
    } else if (globalData.section == "FLOP") {
        globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].wentToFlop = 1;
    }
    
    if ( /\: (raises) /.test(line) ) {
        globalData.raisesInCurrentStreet    +=  1;
        if (parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
            let amount = getAmountFromLine(line);
            if (parseInt(globalData.chipsPutIntoPotByPlayerOnLatestStreet[playerName]) > 0) {
                amount -= parseInt(globalData.chipsPutIntoPotByPlayerOnLatestStreet[playerName]);
            }
            putChipsIntoPot(playerName, parseInt(amount)); 
        }
    }
    if ( /\: (bets|calls) /.test(line) && parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
        let amount = getAmountFromLine(line);
        putChipsIntoPot(playerName, amount);
    }
}

function processAnteOrBlindLine(line, playerName) {
    //save antes&blinds from the newest hand (multiple players can post antes and in cash even blinds, pick the value from latest post)
    let amount = parseInt( getAmountFromLine(line) );
    if ( /: posts (the ante) \d+/.test(line) ) {
        globalData.ante                 =   parseInt(amount);
    } else if ( /: posts (small blind) \d+/.test(line) ) {
        globalData.smallBlind           =   parseInt(amount);
    } else if ( /: posts (big blind) \d+/.test(line) ) {
        globalData.bigBlind             =   parseInt(amount);
    }
    putChipsIntoPot(playerName, parseInt(amount));
}

function putChipsIntoPot(playerName, amount) {
    //used to calculate stack size after last hand
    globalData.players[playerName].stackSizeInChips -= parseInt(amount);

    if (isNaN(globalData.chipsPutIntoPotByPlayerOnLatestStreet[playerName])) {
        globalData.chipsPutIntoPotByPlayerOnLatestStreet[playerName] = parseInt(amount);
    } else {
        globalData.chipsPutIntoPotByPlayerOnLatestStreet[playerName] += parseInt(amount);
    }
}

function processTableLine(line, handNumber, realMoney) {
    if (parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
        //table info from latest hand
        globalData.realMoneyLatestHand = realMoney;
        if (globalData.maxPlayers != parseInt(line.match(/' \d+-max /)[0].split(/[ -]/)[1])) {
            //table size changed --> save maxPlayers and close existing windows
            globalData.maxPlayers = parseInt(line.match(/' \d+-max /)[0].split(/[ -]/)[1])
            for (var windowNo in app.application.get_windows()) {
                app.application.get_windows()[windowNo].close();
            }
        }
        globalData.seatOfButton = line.split(/Seat #/)[1].split(/ /)[0];
    }                
}

function processPreflopAction(line, handNumber, playerName) {
    if (globalData.playerNameOnUTG == "" && parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
        //who's UTG on latest hand?
        globalData.playerNameOnUTG  =   playerName;
    }
    if (globalData.raisesInCurrentStreet==1) {
        //3bet
        globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].preflop3betOpportunity = 1;
        if ( /\: (raises) /.test(line) ) { //raise
            globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].preflop3bet = 1;
        }                
    }
    if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
        //steal opportunity
        globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].atsOpportunity = 1;
    }
    if (/\: (calls|raises) /.test(line)) {
        //preflop call/raise --> VPIP
        globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].vpip = 1;
        if (/\: raises /.test(line)) {
            //preflop raise --> PFR
            globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].pfr = 1;
            if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
                //steal
                globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].ats = 1;
                globalData.facingSteal  = 1;
            }
        }                
        globalData.atsOpportunity = false;
    }
    if (globalData.facingSteal == 1 && globalData.playersLeftToAct == 1) {
        globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].bbFacingSteal = 1;
        if (/\: (folds) /.test(line)) {
            globalData.players[playerName].hands[globalData.players[playerName].hands.length-1].bbFoldVsSteal = 1;        
        }
    }
    globalData.playersLeftToAct -= 1;
}

function processHandSeatLine(line, playerName, realMoney) {
    //save players by hand
    if (globalData.playersByHand[parseInt(globalData.handNumberBeingProcessed)] === undefined) {
        globalData.playersByHand[parseInt(globalData.handNumberBeingProcessed)] = [playerName];
    } else {
        globalData.playersByHand[parseInt(globalData.handNumberBeingProcessed)].push(playerName);
    }

    let seat    = line.split(/[ :]/)[1].trim();
    if (globalData.players[playerName].hands === undefined) { globalData.players[playerName].hands = []; }
    globalData.players[playerName].hands.push( new Stats(1, realMoney, parseInt(globalData.handNumberBeingProcessed), globalData.timeFromHandBeingProcessed) );
    
    //save seats
    if (parseInt(globalData.seatsPickedFromHand) < parseInt(globalData.handNumberBeingProcessed)) {
        //seats are from an older hand, forget about them
        globalData.playerBySeat = [];
        globalData.seatsPickedFromHand = parseInt(globalData.handNumberBeingProcessed);
    }
    if (parseInt(globalData.handNumberBeingProcessed) == parseInt(globalData.latestHandNumber)) {
        //this is the newest hand
        
        //save players for each seat
        globalData.playerBySeat[parseInt(seat)] = playerName;
        if (playerName == globalData.hero) {
            globalData.seatOfHero = parseInt(seat);
        }
        //save stack sizes in big blinds
        let stack   = line.split(/\(/).pop().split(/[( ]/)[0].trim();
        globalData.players[playerName].stackSizeInChips = stack;
    }
}

function playerEliminated(playerName, heroName, historyFileName) {
    if (parseInt(globalData.handNumberBeingProcessed) == parseInt(globalData.latestHandNumber)) {
        //remove from parseInt(seat) list
        for (var seatNo in globalData.playerBySeat) {
            if (globalData.playerBySeat[parseInt(seatNo)] == playerName) {
                globalData.playerBySeat[parseInt(seatNo)] = null;
            }
        }
        //remove window
        for (var windowNo in app.application.get_windows()) {
            let window = app.application.get_windows()[windowNo];
            if (window.get_title().substr(1) == ": "+playerName) {
                window.close();
            }
        }
    }
    if  (playerName == heroName) {
        //hero eliminated --> stop reading this history file    
        globalData.completedHistoryFiles.push(historyFileName);
    }
}

function getPlayerNameFromLine(line) {
    //Take a hand history line and strip away everything but the player name. This seems to be the only way as Poker Stars player names can include all kinds of special characters and there are no delimiters in the history files.
    var noPlayerName = /(\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*|PokerStars Hand #\d+: |Table \'|Total pot \d+ | Rake \d+|Board \[([2-9TJQKA][cdhs][ ]?){3,5}\])/
    if ( noPlayerName.test(line) ) {
        return "";
    }
    
    var beforePlayerName = /(Seat \d: |Dealt to |Uncalled bet \(\d+\) returned to )/
    var afterPlayerName  = /(Seat \d: | \((button|(big|small) blind|\d+ in chips)\)| folded | showed | collected |: posts ((small|big) blind|the ante) \d+|(: shows| mucked)? \[[2-9TJQKA][cdhs] [2-9TJQKA][cdhs]\]|: (bets|calls) \d+|: (folds|checks)|: raises \d+ to \d+| has timed out| is sitting out|: mucks hand|: doesn't show hand| has returned| said, "| finished the tournament in (1st|2nd|3rd|[4-9]th) place| will be allowed to play after the button| joins the table at seat #\d| was removed from the table for failing to post| leaves the table)/;
    line = line.replace(beforePlayerName,"").trim();
    return line.split(afterPlayerName)[0].trim();
}

function getAmountFromLine(line) {
    //Take a hand history line and strip away everything but the amount. This seems to be the only way as Poker Stars player names can include all kinds of special characters and there are no delimiters in the history files.
    line = line.replace(" and is all-in","");

    if (/Seat \d: .+ \(\d+ in chips\)/.test(line)) {
        return  parseInt( line.split(/[( ]/).splice(-4,1) );
    } else if (/.+: posts (the ante|small blind|big blind) \d+/.test(line)) {
        return  parseInt( line.split(" ").splice(-1) );
    } else if (/Uncalled bet \(\d+\) returned to .+/.test(line)) {
        return  parseInt( line.split(/[()]/)[1] );
    } else if (/.+ collected \d+ from pot/.test(line)) {
        return  parseInt( line.split(/[( ]/).splice(-3,1) );
    } else if (/.+: (calls|bets) \d+/.test(line)) {
        return  parseInt( line.split(" ").splice(-1) );
    } else if (/.+: raises \d+ to \d+/.test(line)) {
        return  parseInt( line.split(" ").splice(-1) );
    } else if (/Seat \d: .+ showed \[[2-9TJQKA][cdhs] [2-9TJQKA][cdhs]\] and won \(\d+\) with /.test(line)) {
        return  parseInt( line.split(/[()]/).splice(-2,1) );
    } else if (/Total pot \d+ \| Rake \d+/.test(line)) {
        return  parseInt( line.split(" ")[2] );
    } else {
        return  0;
    }
}

function drawPlayerWindows() {
    for (var seatNo in globalData.playerBySeat) {
        let playerName = globalData.playerBySeat[parseInt(seatNo)];
        if (playerName === null) { continue; }
        refreshPlayerData(playerName);

        //create a statistics window for each player in latest seats
        let positionInRelationToHero = parseInt(seatNo) - parseInt(globalData.seatOfHero);
        if (parseInt(positionInRelationToHero) < 0) { positionInRelationToHero += parseInt(globalData.maxPlayers); }

        let playerWindow = getWindowByPositionInRelationToHero(parseInt(positionInRelationToHero));
        playerWindow.set_keep_above(true);
        playerWindow.set_type_hint(Gdk.WindowTypeHint.DIALOG);
        playerWindow.set_title(positionInRelationToHero+": "+playerName);
        
        //add window components if missing
        if (playerWindow.get_children().length == 0) {
            //add one vertical box in the window
            let vbox = new Gtk.VBox();
            //add x horizontal boxes in the vertical box
            let windowLayout = getWindowLayout(playerName);
            for (var hboxNo in windowLayout) {
                let hbox = new Gtk.HBox();
                //add x textviews in each horizontal box
                for (var widgetNo in windowLayout[hboxNo]) {
                    let widgetName = windowLayout[hboxNo][widgetNo];
                    if (widgetName=="icmNash") {
                        let widget = new Gtk.LinkButton();
                        widget.get_style_context().add_class("link");
                        widget.set_label("P/F");
                        hbox.add(widget);
                    } else {
                        hbox.add(getNotesWidget(widgetName));
                    }
                }
                vbox.add(hbox);
            }
            playerWindow.add(vbox);
        }

        //loop and update component
        let vbox = playerWindow.get_children()[0];
        for (var hboxNo in vbox.get_children()) {
            for (var widgetNo in vbox.get_children()[hboxNo].get_children()) {
                refreshWidget(vbox.get_children()[hboxNo].get_children()[widgetNo], hboxNo, widgetNo, playerName);
            }
        }

        playerWindow.show_all();
    }
}

function getNotesWidget(widgetName) {
    let widget = new Gtk.TextView();
    if (/^notes_range_/.test(widgetName)) {
        widget.set_editable(true);
        widget.set_cursor_visible(true);
        widget.set_tooltip_text("Fill in here your estimate about this player's range on "+widgetName.split("_")[2]);
        widgetSetText(widget,"...");
        widget.get_style_context().add_class("notes");
    } else {
        widget.set_editable(false);
        widget.set_cursor_visible(false);
        if (/^title_notes_range_/.test(widgetName)) {
            widgetSetText(widget," "+widgetName.replace("title_notes_range_","").replace("preflop_","PF").replace("flop_","F").replace("turn_","T").replace("river_","R")+": ");
        }
    }
    return widget;
}

function getWindowLayout(playerName) {
    if (playerName == globalData.hero && globalData.heroWindowLayout !== undefined) {
        return  globalData.heroWindowLayout;
    } else {
        return  globalData.windowLayout;
    }
}

function refreshWidget(subWidget, hboxNo, widgetNo, playerName) {
    let statName = getWindowLayout(playerName)[hboxNo][widgetNo];

    if (statName == "bb") {      //stack size in big blinds
        var value = globalData.players[playerName].stackSizeInChips / globalData.bigBlind;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " "+Math.round(value)+" BB "));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 200, false));
        subWidget.set_tooltip_text("Stack size ("+globalData.players[playerName].stackSizeInChips+" chips) converted&rounded into big blinds.");
    } else if (statName == "icmNash") { //ICM Nash push/fold range
        subWidget.set_uri( getIcmNashUri() );
        subWidget.set_tooltip_text("Displays ICM Nash push/fold ranges");
    } else if (statName == "hands") {   //totalHands
        var value = globalData.players[playerName].stats.hands;
        widgetSetText(subWidget,(isNaN(value) ? "-" : "("+Math.round(value)+")"));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 500, true));
        var totalHands  =   globalData.players[playerName].hands.length;
        var tooltip     =   "Stats are calculated using ";
        if (value == totalHands) {
            tooltip += "all "+value+" hands";
        } else {
            tooltip += value+"/"+totalHands+" most relevant hands";
        }
        tooltip += globalData.players[playerName].leastRelevantHandUsedInStats;
        subWidget.set_tooltip_text(tooltip);
    } else if (statName == "vpip") {    //vpip
        var value = globalData.players[playerName].stats.vpip / globalData.players[playerName].stats.hands * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text(getRangeDescription(value)+"\nVoluntarily Put $ In Pot. Percentage of hands the player called or raised preflop.");
    } else if (statName == "pfr") {     //pfr
        var value =  globalData.players[playerName].stats.pfr /  globalData.players[playerName].stats.hands * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text(getRangeDescription(value)+"\nPre Flop Raise. The percentage of the hands a player raises before the flop.");
    } else if (statName == "preflop3bet") { //preflop3bet
        var value =  globalData.players[playerName].stats.preflop3bet /  globalData.players[playerName].stats.preflop3betOpportunity * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " 3B "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text(getRangeDescription(value)+"\nPreflop 3bet. How often does the player reraise preflop when there's one raise before them.");
    } else if (statName == "ats") {     //ats
        var value =  globalData.players[playerName].stats.ats /  globalData.players[playerName].stats.atsOpportunity * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " ATS "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text(getRangeDescription(value)+"\nAttempt To Steal the blinds. The percentage of the hands a player raises before the flop, when folded to them in cutoff, button or small blind.");
    } else if (statName == "bbfvs") {   //BB fold vs. steal
        var value =  globalData.players[playerName].stats.bbFoldVsSteal /  globalData.players[playerName].stats.bbFacingSteal * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " BBFS "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("BB fold vs. steal. The percentage of the hands the player folds when facing a preflop steal.");
    } else if (statName == "wtsd") {    //WTSD
        var value =  globalData.players[playerName].stats.postflopShowdown / globalData.players[playerName].stats.wentToFlop * 100;
        widgetSetText(subWidget,(isNaN(value) ? "-" : " WTSD "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("The percentage of the hands that went to show down, out of the ones that saw the flop.");
    }
}

function getRangeDescription(percentage) {
    let selectedHands   =   0;
    let totalHands      =   52*51;
    let targetHands     =   (percentage/100)*totalHands;
    
    //weakest hands per category in selected range
    let offsuitRange    =   "";
    let pairRange       =   "";
    let suitedRange     =   "";

    for (var handNo in globalData.handRank) {
        let hand    =   globalData.handRank[handNo];
        let hands   =   0;

        if (/[2-9TJQKA]{2}o/.test(hand) ) {
            hands = 8*3;    //offsuit combos
        } else if (/[2-9TJQKA]{2}$/.test(hand) ) {
            hands = 4*3;    //pair combos
        } else if (/[2-9TJQKA]{2}s/.test(hand) ) {
            hands = 8*1;    //suited combos
        }
        
        if ( Math.abs(selectedHands+hands-targetHands) < Math.abs(selectedHands-targetHands) ) {
            selectedHands += hands;        

            if (/[2-9TJQKA]{2}o/.test(hand) ) {
                offsuitRange    =   hand+"+";   //weakest selected offsuit hand
            } else if (/[2-9TJQKA]{2}$/.test(hand) ) {
                pairRange       =   hand+"+";   //weakest selected pair
            } else if (/[2-9TJQKA]{2}s/.test(hand) ) {
                suitedRange     =   hand+"+";   //weakest selected suited hand
            }
        } else {
            break;
        }
    }
    return  "Estimated range: "+(offsuitRange+" "+pairRange+" "+suitedRange).trim();
}

function getIcmNashUri() {
    let uri = "http://www.holdemresources.net/h/web-calculators/nashicm/results.html?action=calculate&sb="+globalData.smallBlind+"&bb="+globalData.bigBlind+"&ante="+globalData.ante+"&structure="+globalData.priceStructure;
    
    let stackId     =   1;
    let pickPlayer  =   false;
    let players     =   globalData.playersByHand[parseInt(globalData.latestHandNumber)];
    //pick players _after_ current UTG (first one is next hand's UTG)
    for (var playerNo in players) {
        if (pickPlayer && globalData.players[players[playerNo]].stackSizeInChips>0) {
            uri     +=  "&s"+stackId+"="+globalData.players[players[playerNo]].stackSizeInChips;
            stackId +=  1;
        } else if (players[playerNo] == globalData.playerNameOnUTG) {
            pickPlayer = true; //pick first player after big blind
        }
    }
    //pick players until current UTG (no duplicates please)
    for (var playerNo in players) {
        if (globalData.players[players[playerNo]].stackSizeInChips>0) {
            uri     +=  "&s"+stackId+"="+globalData.players[players[playerNo]].stackSizeInChips;
            stackId +=  1;
        }
        if (players[playerNo] == globalData.playerNameOnUTG) {
            break;
        }
    }
    
    return  uri;
}

function widgetSetText(widget,text) {
    let textBuffer = new Gtk.TextBuffer();
    textBuffer.set_text(text, text.length);
    widget.set_buffer(textBuffer);
}
function widgetGetText(widget) {
    let textBuffer = widget.get_buffer();
    return textBuffer.get_text(textBuffer.get_start_iter(), textBuffer.get_end_iter(), false);
}

function getStatColor(value, maxValue, lowIsRed) {
    //hue:    worst=0 (red),   best=2/3 (blue)
    let hue = value / maxValue * 2 / 3;
    if (hue > 2/3) {
        hue = 2/3;
    } else if (hue < 0) {
        hue = 0;
    }
    
    if (!lowIsRed) {
        //hue:    worst=2/3 (blue),   best=0 (red)
        hue = (2/3)-hue;    //  2/3 <--> 0
    }
    
    return hslaToRGBA(hue, 1, 0.75, 1);
}

function hslaToRGBA(h, s, l, a){
    //hue, saturation, lightness, alpha --> red, green, blue, alpha
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return new Gdk.RGBA({
        red:    r
    ,   green:  g
    ,   blue:   b
    ,   alpha:  a
    });
}

function getWindowByPositionInRelationToHero(positionInRelationToHero) {
    //existing window
    for (var windowNo in app.application.get_windows()) {
        let window = app.application.get_windows()[windowNo];
        
        if (window.get_title().substring(0,3) == parseInt(positionInRelationToHero)+": ") {
            return window;
        }
    }

    //new window
    let playerWindow = new Gtk.Window();
    playerWindow.resize(200,1);
    playerWindow.set_title(parseInt(positionInRelationToHero)+": (loading)");

	loadWindowPosition(playerWindow);
	playerWindow.connect('destroy', Gtk.main_quit); //quit whole app when any window gets closed
	playerWindow.connect('configure-event', function(window) { 
	    saveWindowPosition(playerWindow);
    });
    app.application.add_window(playerWindow);
    
    return playerWindow;
}

function saveWindowPosition(window) {
    for (var windowPositionId in globalData.windowPositions) {
        if (    globalData.windowPositions[windowPositionId].maxPlayers                 == parseInt(globalData.maxPlayers)
            &&  globalData.windowPositions[windowPositionId].positionInRelationToHero   == parseInt(window.get_title().substr(0,1))) {
        
            //set window position by the edge closest to the middle of the screen and grow towards the edge of the screen
            if (parseInt(window.get_position()[0]) < parseInt(Gdk.Screen.get_default().get_width()/2)) {
                //left
                if (parseInt(window.get_position()[1]) < parseInt(Gdk.Screen.get_default().get_height()/2)) {
                    //window is in top left quarter of the screen
                    window.set_gravity(Gdk.Gravity.SOUTH_EAST);
                } else {
                    //window is in bottom left quarter of the screen
                    window.set_gravity(Gdk.Gravity.NORTH_EAST);                        
                }
            } else {
                //right
                if (parseInt(window.get_position()[1]) < parseInt(Gdk.Screen.get_default().get_height()/2)) {
                    //window is in top right quarter of the screen
                    window.set_gravity(Gdk.Gravity.SOUTH_WEST);
                } else {
                    //window is in bottom right quarter of the screen
                    window.set_gravity(Gdk.Gravity.NORTH_WEST);                        
                }
            }

            globalData.windowPositions[windowPositionId].x          = parseInt(window.get_position()[0]);
            globalData.windowPositions[windowPositionId].y          = parseInt(window.get_position()[1]);
            globalData.windowPositions[windowPositionId].width      = parseInt(window.get_size()[0]);
            globalData.windowPositions[windowPositionId].height     = parseInt(window.get_size()[1]);
            globalData.windowPositions[windowPositionId].gravity    = parseInt(window.get_gravity());
            
            return;
        }
    }

    globalData.windowPositions.push( 
        new WindowPosition(parseInt(globalData.maxPlayers), window.get_title().substr(0,1), window.get_position()[0], window.get_position()[1], window.get_size()[0], window.get_size()[1], parseInt(window.get_gravity()) )
    );
}

function loadWindowPosition(window) {
    for (var windowPositionId in globalData.windowPositions) {
        if (    globalData.windowPositions[windowPositionId].maxPlayers                 == parseInt(globalData.maxPlayers)
            &&  globalData.windowPositions[windowPositionId].positionInRelationToHero   == parseInt(window.get_title().substr(0,1))
        ) {
            if (globalData.windowPositions[windowPositionId].gravity !== undefined) {
                window.set_gravity( globalData.windowPositions[windowPositionId].gravity );
            }
            if (globalData.windowPositions[windowPositionId].x !== undefined && globalData.windowPositions[windowPositionId].y !== undefined) {
                window.move(    globalData.windowPositions[windowPositionId].x      , globalData.windowPositions[windowPositionId].y        );
            }
            return;
        }
    }
}

function saveData() {
    saveFile("data",JSON.stringify(globalData.windowPositions));
}

function saveFile(filename,content) {
    let file = Gio.file_new_for_path(hudPath+"/"+filename);
    if (!file.query_exists(null)) {
        var file_stream = file.create(Gio.FileCreateFlags.NONE,null);
    }
    if (file.query_exists(null)) {
        file.replace_contents(content,null,false,Gio.FileCreateFlags.NONE,null);
    }
}

function loadData() {
    let file = Gio.file_new_for_path(hudPath+"/data");
	if (file.query_exists(null)) {
        let fileContent = file.read(null).read_bytes(1000000,null).get_data()+ "";
        globalData.windowPositions = JSON.parse(fileContent);
    }
}

function refreshPlayerData(playerName) {
    globalData.players[playerName].stats    =   new Stats(0,null);

    //set relevanceScore score for hands
    for (var handIndex in globalData.players[playerName].hands) {
        globalData.players[playerName].hands[parseInt(handIndex)].relevanceScore = 0;
        //real money / play money
        if (globalData.players[playerName].hands[parseInt(handIndex)].realMoney == globalData.realMoneyLatestHand) {
            globalData.players[playerName].hands[parseInt(handIndex)].relevanceScore += 1;
        }
        //players on table
        let handNumber          =   globalData.players[playerName].hands[parseInt(handIndex)].handNumber;
        let playersOnHand       =   globalData.playersByHand[handNumber].length;
        let playersOnTableNow   =   globalData.playersByHand[globalData.latestHandNumber].length;
        globalData.players[playerName].hands[parseInt(handIndex)].relevanceScore += 1 - (Math.abs(playersOnHand-playersOnTableNow)/7);
        //time
        let timeRelevance = (globalData.players[playerName].hands[parseInt(handIndex)].time - globalData.timeFromOldestHand) / (globalData.timeFromNewestHand - globalData.timeFromOldestHand);
        globalData.players[playerName].hands[parseInt(handIndex)].relevanceScore += timeRelevance;
    }

    //sort hands by relevanceScore
    globalData.players[playerName].hands.sort(sortHandsByRelevance);

    //sum the stats
    for (var handIndex in globalData.players[playerName].hands) {
        //sum each property from each hand into the player's sums
        for (var stat in globalData.players[playerName].hands[parseInt(handIndex)]) {
            globalData.players[playerName].stats[stat] += globalData.players[playerName].hands[parseInt(handIndex)][stat];
        }
        if  (handIndex >= globalData.maxHands-1) { 
            //enough hands
            break; 
        }
    }

    //info about the least relevant hand used to calculate the stats (shown in the tooltip of "hands" stat)
    let leastRelevantHandUsedInStats =   "\n\nLeast relevant hand used in stats was:\n";
    if (globalData.players[playerName].hands[parseInt(handIndex)].realMoney == 1) {
        leastRelevantHandUsedInStats +=   "real money hand";
    } else {
        leastRelevantHandUsedInStats +=   "play money hand";
    }
    let handNumber          =   globalData.players[playerName].hands[parseInt(handIndex)].handNumber;
    leastRelevantHandUsedInStats +=   " with "+globalData.playersByHand[handNumber].length+" players";
    leastRelevantHandUsedInStats +=   ", "+globalData.players[playerName].hands[parseInt(handIndex)].time.toLocaleFormat(globalData.dateTimeFormat).toString();
    globalData.players[playerName].leastRelevantHandUsedInStats = leastRelevantHandUsedInStats;
}

function sortHandsByRelevance(a,b) {
    return parseFloat(b.relevanceScore) - parseFloat(a.relevanceScore);
}
