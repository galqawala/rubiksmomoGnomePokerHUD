#!/usr/bin/gjs

/*
    https://people.gnome.org/~gcampagna/docs/
    https://wibblystuff.blogspot.fi/2015/05/first-time-for-everything-gnome.html
*/

const Lang = imports.lang;
const Gtk  = imports.gi.Gtk;
const Gdk  = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gio  = imports.gi.Gio;

var globalData                  = new Data();
//path of the hud directory
var hudPath                     = GLib.get_home_dir()+"/rubiksmomoGnomePokerHUD";
//path of the hand history root, that contains a directory for each player name
var handHistoryPath             = GLib.get_home_dir()+"/PlayOnLinux's virtual drives/pokerStars2016/drive_c/Program Files/PokerStars.EU/HandHistory";

function Data() {
    this.hero                       =   "";
    this.latestHandNumber           =   0;
    this.processedUntilHandNumber   =   0;
    this.seatsPickedFromHand        =   0;
    this.heroSeat                   =   0;
    this.bigBlind                   =   0;
    this.players                    =   [];
    this.realMoney                  =   true;
    this.playersByHand              =   [];
    this.atsOpportunity             =   true;
    this.playersLeftToAct           =   0;
    this.maxPlayers                 =   0;
    this.windowPositions            =   [];
}

function windowPosition(maxPlayers,positionInRelationToHero,x,y) {
    this.maxPlayers                 =   parseInt(maxPlayers);
    this.positionInRelationToHero   =   parseInt(positionInRelationToHero);
    this.x                          =   parseInt(x);
    this.y                          =   parseInt(y);
}

function PlayerData(playerName) {
    this.playerName                 =   playerName;
    this.filter                     =   new Filter();
    this.seat                       =   0;
    this.stackSizeInChips           =   0;
    this.getStackSizeInBigBlinds    =   function() {
        //stack size is read before big blind is posted
        return this.stackSizeInChips / globalData.bigBlind;
    };
    this.hands                      =   [];
    this.totalHands                 =   0;
    this.vpipHands                  =   0;
    this.getVpipPercent             =   function() {
        return (this.vpipHands / this.totalHands * 100);
    };
    this.pfrHands                   =   0;
    this.getPfrPercent              =   function() {
        return (this.pfrHands / this.totalHands * 100);
    };
    this.atsOpportunityHands        =   0;
    this.atsHands                   =   0;
    this.getAtsPercent              =   function() {
        return (this.atsHands / this.atsOpportunityHands * 100);
    };
}

function PlayerHand(realMoney) {
    this.realMoney                  =   realMoney;
    this.vpip                       =   0;
    this.pfr                        =   0;
    this.atsOpportunity             =   0;
    this.ats                        =   0;
}

function Filter() {
    this.realMoney                  =   null;   //null = all, true = only real money hands, false = only play money hands
    this.playersOnTableMin          =   2;
    this.playersOnTableMax          =   9;
    this.getTooltip                 =   function() {
        let description = "";
        if (this.realMoney == true) {
            description += "Only real money hands. ";
        } else if (this.realMoney == false) {
            description += "Only play money hands. ";
        }
        if (this.playersOnTableMin == this.playersOnTableMax) {
            description += "Only hands where table had "+this.playersOnTableMin+" players. ";                    
        } else if (this.playersOnTableMin > 2 || this.playersOnTableMax < 9) {
            description += "Only hands where table had "+this.playersOnTableMin+"-"+this.playersOnTableMax+" players. ";              
        }        
        return description.trim();
    };
    this.getText                    =   function() {
        if (this.getTooltip() != "") {
            return "F"; //filter on
        } else {
            return "";  //filter off        
        }
    };
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
//        cssProvider.load_from_path(GLib.get_home_dir()+"/rubiksmomoGnomePokerHUD/rubiksmomoGnomePokerHUD.css");
        cssProvider.load_from_path(hudPath+"/rubiksmomoGnomePokerHUD.css");
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProvider, 400);
        
        loadData();
        refreshHud();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, refreshHud);
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
//    let handDirectory           = Gio.File.new_for_path(GLib.get_home_dir()+"/PlayOnLinux's virtual drives/pokerStars2016/drive_c/Program Files/PokerStars.EU/HandHistory");
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

            if (!fileInfo.get_name().endsWith("~")) {
                print("========== reading file: "+fileInfo.get_name()+" ==========");
                //Process files without ~ filename suffix
                let fileContent = file.read(null).read_bytes(1000000,null).get_data() + "";
                let lines = fileContent.split("\n");
                getStatsFromHistoryLines(lines, playerHandDirectoryInfo.get_name());
            }
        }
    }
    
    globalData.processedUntilHandNumber = parseInt(globalData.latestHandNumber);
}

function addHand(player, handNumber, realMoney) {
    if (globalData.players[player].hands === undefined) {
        globalData.players[player].hands = [];
    }
    if (globalData.players[player].hands[parseInt(handNumber)] === undefined) {
        globalData.players[player].hands[parseInt(handNumber)] = new PlayerHand(realMoney);
    }
}

function refreshPlayerData(playerName) {
    globalData.players[playerName].totalHands           = 0;
    globalData.players[playerName].vpipHands            = 0;
    globalData.players[playerName].pfrHands             = 0;
    globalData.players[playerName].atsOpportunityHands  = 0;
    globalData.players[playerName].atsHands             = 0;
    
    //include current table size in filtering
    let playersOnTableNow = globalData.playersByHand[globalData.latestHandNumber].length;
    if (globalData.players[playerName].filter.playersOnTableMin > playersOnTableNow) {
        globalData.players[playerName].filter.playersOnTableMin = playersOnTableNow;
    }
    if (globalData.players[playerName].filter.playersOnTableMax < playersOnTableNow) {
        globalData.players[playerName].filter.playersOnTableMax = playersOnTableNow;
    }
    
    for (var handNumber in globalData.players[playerName].hands) {
        let playersOnHand = globalData.playersByHand[handNumber].length;
        if (    //passes filters
                (globalData.players[playerName].filter.realMoney === null || globalData.players[playerName].filter.realMoney === globalData.players[playerName].hands[parseInt(handNumber)].realMoney)
            &&  (playersOnHand >= globalData.players[playerName].filter.playersOnTableMin)
            &&  (playersOnHand <= globalData.players[playerName].filter.playersOnTableMax)
        ) {
            globalData.players[playerName].totalHands           += 1;
            globalData.players[playerName].vpipHands            += globalData.players[playerName].hands[parseInt(handNumber)].vpip;
            globalData.players[playerName].pfrHands             += globalData.players[playerName].hands[parseInt(handNumber)].pfr;
            globalData.players[playerName].atsOpportunityHands  += globalData.players[playerName].hands[parseInt(handNumber)].atsOpportunity;
            globalData.players[playerName].atsHands             += globalData.players[playerName].hands[parseInt(handNumber)].ats;
        }
    }
    
    if (globalData.players[playerName].totalHands > 500) {
        //many hands, let's filter to get the most relevant hands
        if (globalData.players[playerName].filter.realMoney === null) {
            //filter by real/play money
            globalData.players[playerName].filter.realMoney =   globalData.realMoney;
            refreshPlayerData(playerName);
        } else if ( (playersOnTableNow - globalData.players[playerName].filter.playersOnTableMin)
                >   (globalData.players[playerName].filter.playersOnTableMax - playersOnTableNow) ) {
            globalData.players[playerName].filter.playersOnTableMin += 1;
            refreshPlayerData(playerName);
        } else if (    (globalData.players[playerName].filter.playersOnTableMax > playersOnTableNow) ) {
            globalData.players[playerName].filter.playersOnTableMax -= 1;
            refreshPlayerData(playerName);
        }
    }
}

function getStatsFromHistoryLines(lines, heroName) {
    let handNumber       = 0;
    let section          = "";
    let realMoney        = true;

    for (var lineNumber in lines) {
        let playerName = getPlayerNameFromLine(lines[lineNumber]);
        if (globalData.players[playerName] === undefined) {
            globalData.players[playerName] = new PlayerData(playerName);
        }
    
        //loop lines in hand history file
        if ( /PokerStars Hand #/.test(lines[lineNumber]) ) {
            section         = "PokerStars Hand";
            
            //get hand number (we'll show stats for the players that were present in last hand)
            handNumber = parseInt(lines[lineNumber].split(":")[0].split("#")[1]);
            if (parseInt(handNumber) > parseInt(globalData.latestHandNumber)) {
                //newest hand so far
                globalData.latestHandNumber =   parseInt(handNumber);
                globalData.hero             =   heroName;
            }
        }
        
        if (parseInt(handNumber) > globalData.processedUntilHandNumber) {
            if ( /^Seat /.test(lines[lineNumber]) && section != "SUMMARY") {
                processHandSeatLine(lines[lineNumber], handNumber, playerName, realMoney);
            } else if ( /\*\*\* /.test(lines[lineNumber])) {
                section     = lines[lineNumber].split(/\*\*\*/)[1].trim();
                if (section=="HOLE CARDS") {
                    globalData.atsOpportunity = true;
                } else {
                    globalData.atsOpportunity = false;                
                }
                globalData.playersLeftToAct = globalData.playersByHand[parseInt(handNumber)].length;
            } else if (/^Table /.test(lines[lineNumber]) && section == "PokerStars Hand") {
                if (/ \(Play Money\) /.test(lines[lineNumber])) {
                    realMoney = false;
                } else {
                    realMoney = true;
                }
                
                if (parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
                    //table info from latest hand
                    globalData.realMoney  = realMoney;
                    if (globalData.maxPlayers != parseInt(lines[lineNumber].match(/' \d+-max /)[0].split(/[ -]/)[1])) {
                        //table size changed --> save maxPlayers and close existing windows
                        globalData.maxPlayers = parseInt(lines[lineNumber].match(/' \d+-max /)[0].split(/[ -]/)[1])
                        for (var windowNo in app.application.get_windows()) {
                            app.application.get_windows()[windowNo].close();
                        }
                    }
                }                
            } else if ( /: posts big blind \d+/.test(lines[lineNumber]) && parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
                //save big blind from newest hand
                globalData.bigBlind    = parseInt( lines[lineNumber].split(/ /).pop().trim() );
            } else if ( section=="HOLE CARDS" && /[:] (calls|raises|folds) /.test(lines[lineNumber])) {
                processPreflopAction(lines[lineNumber], handNumber, playerName, section);
            } else if (/ finished the tournament in /.test(lines[lineNumber])) {
                playerEliminated(playerName);
            }
        }
    }
}

function processPreflopAction(line, handNumber, playerName, section) {
    if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
        //steal opportunity
        globalData.players[playerName].hands[parseInt(handNumber)].atsOpportunity = 1;
    }
    //preflop action
    if ( section=="HOLE CARDS" && /[:] (calls|raises) /.test(line)) {
        //preflop call/raise --> VPIP
        globalData.players[playerName].hands[parseInt(handNumber)].vpip = 1;
        if (/[:] raises /.test(line)) {
            //preflop raise --> PFR
            globalData.players[playerName].hands[parseInt(handNumber)].pfr = 1;
            if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
                //steal
                globalData.players[playerName].hands[parseInt(handNumber)].ats = 1;
            }
        }                
        globalData.atsOpportunity = false;
    }
    globalData.playersLeftToAct -= 1;
}

function processHandSeatLine(line, handNumber, playerName, realMoney) {
    //save players by hand
    if (globalData.playersByHand[parseInt(handNumber)] === undefined) {
        globalData.playersByHand[parseInt(handNumber)] = [playerName];
    } else {
        globalData.playersByHand[parseInt(handNumber)].push(playerName);
    }

    let seat    = line.split(/[ :]/)[1].trim();
    addHand(playerName, parseInt(handNumber), realMoney);
    //save seats
    if (parseInt(globalData.seatsPickedFromHand) < parseInt(handNumber)) {
        //seats are from an older hand, forget about them
        globalData.playerBySeat = [];
        globalData.seatsPickedFromHand = parseInt(handNumber);
    }
    if (parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
        //this is the newest hand
        
        //save players for each seat
        globalData.playerBySeat[parseInt(seat)] = playerName;
        if (playerName == globalData.hero) { 
            globalData.heroSeat = parseInt(seat);
        }
        //save stack sizes in big blinds
        let stack   = line.split(/\(/).pop().split(/[( ]/)[0].trim();
        globalData.players[playerName].stackSizeInChips = stack;
    }
}

function playerEliminated(playerName) {
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

function drawPlayerWindows() {
    for (var seatNo in globalData.playerBySeat) {
        let playerName = globalData.playerBySeat[parseInt(seatNo)];
        if (playerName === null) { continue; }
        refreshPlayerData(playerName);

        //create a statistics window for each player in latest seats
        let positionInRelationToHero = parseInt(seatNo) - parseInt(globalData.heroSeat);
        if (parseInt(positionInRelationToHero) < 0) { positionInRelationToHero += parseInt(globalData.maxPlayers); }

        let playerWindow = getWindowByPositionInRelationToHero(parseInt(positionInRelationToHero));
        playerWindow.set_keep_above(true);
        playerWindow.set_type_hint(Gdk.WindowTypeHint.DIALOG);
        playerWindow.set_title(parseInt(positionInRelationToHero)+": "+playerName);
        for (var widgetNo in playerWindow.get_children()) {
            let widget = playerWindow.get_children()[widgetNo];
            
            while (widget.get_children().length < 6) {
                let textView = new Gtk.TextView();
                textView.set_editable(false);
                textView.set_cursor_visible(false);
                widget.add(textView);        
            }
            
            for (var subWidgetNo in widget.get_children()) {
                let subWidget = widget.get_children()[subWidgetNo];
                
                if (subWidgetNo == 0) {         //filter
                    widgetSetText(subWidget,globalData.players[playerName].filter.getText());                        
                    subWidget.set_tooltip_text(globalData.players[playerName].filter.getTooltip());
                } else if (subWidgetNo == 1) {  //stack size in big blinds
                    widgetSetText(subWidget," "+Math.round(globalData.players[playerName].getStackSizeInBigBlinds())+" BB ");
                    subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(globalData.players[playerName].getStackSizeInBigBlinds(), 200, false));
                    subWidget.set_tooltip_text("Stack size in big blinds (from the beginning of last hand).");
                } else if (subWidgetNo == 2) {  //totalHands
                    widgetSetText(subWidget,"("+globalData.players[playerName].totalHands+")");
                    subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(globalData.players[playerName].totalHands, 500, true));
                    subWidget.set_tooltip_text("Total number of hands dealt to the player.");
                } else if (subWidgetNo == 3) {  //vpip
                    widgetSetText(subWidget," VP "+Math.round(globalData.players[playerName].getVpipPercent()));
                    subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(globalData.players[playerName].getVpipPercent(), 100, true));
                    subWidget.set_tooltip_text("Voluntarily Put $ In Pot. Percentage of hands the player called or raised preflop.");
                } else if (subWidgetNo == 4) {  //pfr
                    widgetSetText(subWidget," PFR "+Math.round(globalData.players[playerName].getPfrPercent()));
                    subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(globalData.players[playerName].getPfrPercent(), 100, true));
                    subWidget.set_tooltip_text("Pre Flop Raise. The percentage of the hands a player raises before the flop.");
                } else if (subWidgetNo == 5) {  //ats
                    widgetSetText(subWidget," ATS "+Math.round(globalData.players[playerName].getAtsPercent()));
                    subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(globalData.players[playerName].getAtsPercent(), 100, true));
                    subWidget.set_tooltip_text("Attempt To Steal the blinds. The percentage of the hands a player raises before the flop, when folded to them in cutoff, button or small blind.");
                }
            }
        }

        playerWindow.show_all();
    }
}

function widgetSetText(widget,text) {
    let textBuffer = new Gtk.TextBuffer();
    textBuffer.set_text(text, text.length);
    widget.set_buffer(textBuffer);
}

function getStatColor(value, maxValue, lowIsRed) {
    //hue:    worst=0 (red),   best=2/3 (blue)
    let hue = value / maxValue;
    if (hue > 2/3) {
        hue = 2/3;
    } else if (hue < 0) {
        hue = 0;
    }
    
    if (!lowIsRed) {
        //hue:    worst=2/3 (blue),   best=0 (red)
        hue = (2/3)-hue;    //  2/3 <--> 0
    }
    
    return hslaToRGBA(hue, 1, 0.74, 1);
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
    let statBox = new Gtk.HBox();
    playerWindow.add(statBox);
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
        
            globalData.windowPositions[windowPositionId].x = parseInt(window.get_position()[0]);
            globalData.windowPositions[windowPositionId].y = parseInt(window.get_position()[1]);
            return;
        }
    }

    globalData.windowPositions.push( new windowPosition(parseInt(globalData.maxPlayers), window.get_title().substr(0,1), window.get_position()[0], window.get_position()[1]) );
}

function loadWindowPosition(window) {
    for (var windowPositionId in globalData.windowPositions) {
        if (    globalData.windowPositions[windowPositionId].maxPlayers                 == parseInt(globalData.maxPlayers)
            &&  globalData.windowPositions[windowPositionId].positionInRelationToHero   == parseInt(window.get_title().substr(0,1))
        ) {
            window.move( globalData.windowPositions[windowPositionId].x , globalData.windowPositions[windowPositionId].y );
            return;
        }
    }
}

function saveData() {
//    let file = Gio.file_new_for_path(GLib.get_home_dir()+"/rubiksmomoGnomePokerHUD/data");
    let file = Gio.file_new_for_path(hudPath+"/data");
    if (!file.query_exists(null)) {
        var file_stream = file.create(Gio.FileCreateFlags.NONE,null);
    }
    if (!file.query_exists(null)) {
        print("Failed to save window position!");
    } else {
        file.replace_contents(JSON.stringify(globalData.windowPositions),null,false,Gio.FileCreateFlags.NONE,null);
    }
}

function loadData() {
//	let file = Gio.file_new_for_path(GLib.get_home_dir()+"/rubiksmomoGnomePokerHUD/data");
    let file = Gio.file_new_for_path(hudPath+"/data");
	if (file.query_exists(null)) {
        let fileContent = file.read(null).read_bytes(1000000,null).get_data()+ "";
        globalData.windowPositions = JSON.parse(fileContent);
    }
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
