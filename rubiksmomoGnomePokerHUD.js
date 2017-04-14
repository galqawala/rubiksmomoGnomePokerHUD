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
//var handHistoryPath             = GLib.get_home_dir()+"/HandHistoryTest";

function Data() {
    this.hero                           =   "";
    this.latestHandNumber               =   0;
    this.processedUntilHandNumber       =   0;
    this.seatsPickedFromHand            =   0;
    this.heroSeat                       =   0;
    this.bigBlind                       =   0;
    this.players                        =   [];
    this.realMoneyLatestHand            =   true;
    this.playersByHand                  =   [];
    this.atsOpportunity                 =   true;
    this.playersLeftToAct               =   0;
    this.maxPlayers                     =   0;
    this.windowPositions                =   [];
    this.facingSteal                    =   0;
    this.windowLayout                   =   [["filter","bb","hands","vpip","pfr"],["ats","bbfvs","wtsd"]];
}

function windowPosition(maxPlayers,positionInRelationToHero,x,y,width,height,gravity) {
    this.maxPlayers                 =   parseInt(maxPlayers);
    this.positionInRelationToHero   =   parseInt(positionInRelationToHero);
    this.x                          =   parseInt(x);
    this.y                          =   parseInt(y);
    this.width                      =   parseInt(width);
    this.height                     =   parseInt(height);
    this.gravity                    =   parseInt(gravity);
}

function PlayerData(playerName) {
    this.playerName                 =   playerName;
    this.seat                       =   0;
    this.stackSizeInChips           =   0;
    this.filter                     =   new Filter();
    this.stats                      =   [];
}

function Stats(hands,realMoney) {
    //Used to store stats about single hand and totals of multiple hands. Each stat/property indicates number of such hands, unless otherwise commented.
    this.hands                      =   hands;
    this.realMoney                  =   realMoney; //boolean (only for single hand)
    this.vpip                       =   0;
    this.pfr                        =   0;
    this.atsOpportunity             =   0;
    this.ats                        =   0;
    this.bbFacingSteal              =   0;
    this.bbFoldVsSteal              =   0;
    this.wentToFlop                 =   0;
    this.postflopShowdown           =   0;
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
    print("========== refreshing ==========");
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
                print("===== read file: "+fileInfo.get_name()+" =====");
                //Process files without ~ filename suffix
                let fileContent = file.read(null).read_bytes(1000000,null).get_data() + "";
                let lines = fileContent.split("\n");
                getStatsFromHistoryLines(lines, playerHandDirectoryInfo.get_name(), !( / Play Money /.test(fileInfo.get_name()) ) );
            }
        }
    }
    
    globalData.processedUntilHandNumber = parseInt(globalData.latestHandNumber);
}

function getStatsFromHistoryLines(lines, heroName, realMoney) {
    let handNumber       = 0;
    let section          = "";

    for (var lineNumber in lines) {
        let playerName = getPlayerNameFromLine(lines[lineNumber]);
        if (globalData.players[playerName] === undefined) {
            globalData.players[playerName] = new PlayerData(playerName);
        }
    
        //loop lines in hand history file
        if ( /PokerStars Hand #/.test(lines[lineNumber]) ) {
            section                 = "PokerStars Hand";
            globalData.wentToFlop   = false;
            
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
                globalData.facingSteal      = 0;
            } else if (/^Table /.test(lines[lineNumber]) && section == "PokerStars Hand") {
                processTableLine(lines[lineNumber], handNumber, realMoney);
            } else if ( /: posts big blind \d+/.test(lines[lineNumber]) && parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
                //save big blind from newest hand
                globalData.bigBlind    = parseInt( lines[lineNumber].split(/ /).pop().trim() );
            } else if ( section=="HOLE CARDS" && /\: (calls|raises|folds) /.test(lines[lineNumber])) {
                processPreflopAction(lines[lineNumber], handNumber, playerName, section);
            } else if (/ finished the tournament in /.test(lines[lineNumber]) && parseInt(handNumber) == parseInt(globalData.latestHandNumber)) {
                playerEliminated(playerName);
            } else if (section == "FLOP" && /\: (checks|calls|bets|raises|folds) /.test(lines[lineNumber])) {
                //player saw the flop (before show down)
                globalData.players[playerName].hands[parseInt(handNumber)].wentToFlop = 1;
            } else if (section == "SHOW DOWN" && /\: (mucks|shows) (hand|\[[2-9TJQKA][cdhs] [2-9TJQKA][cdhs]\])/.test(lines[lineNumber]) && globalData.players[playerName].hands[parseInt(handNumber)].wentToFlop == 1) {
                //went to showdown post flop
                globalData.players[playerName].hands[parseInt(handNumber)].postflopShowdown = 1;    
            }
        }
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
    }                
}

function processPreflopAction(line, handNumber, playerName, section) {
    if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
        //steal opportunity
        globalData.players[playerName].hands[parseInt(handNumber)].atsOpportunity = 1;
    }
    if (/\: (calls|raises) /.test(line)) {
        //preflop call/raise --> VPIP
        globalData.players[playerName].hands[parseInt(handNumber)].vpip = 1;
        if (/\: raises /.test(line)) {
            //preflop raise --> PFR
            globalData.players[playerName].hands[parseInt(handNumber)].pfr = 1;
            if (globalData.atsOpportunity && globalData.playersLeftToAct <= 4 && globalData.playersLeftToAct > 1) {
                //steal
                globalData.players[playerName].hands[parseInt(handNumber)].ats = 1;
                globalData.facingSteal  = 1;
            }
        }                
        globalData.atsOpportunity = false;
    }
    if (globalData.facingSteal == 1 && globalData.playersLeftToAct == 1) {
        globalData.players[playerName].hands[parseInt(handNumber)].bbFacingSteal = 1;
        if (/\: (folds) /.test(line)) {
            globalData.players[playerName].hands[parseInt(handNumber)].bbFoldVsSteal = 1;        
        }
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
        playerWindow.set_title(positionInRelationToHero+": "+playerName);
        
        //add window components if missing
        if (playerWindow.get_children().length == 0) {
            //add one vertical box in the window
            let vbox = new Gtk.VBox();
            //add x horizontal boxes in the vertical box
            for (var hboxNo in globalData.windowLayout) {
                let hbox = new Gtk.HBox();
                //add x textviews in each horizontal box
                for (var textViewNo in globalData.windowLayout[hboxNo]) {
                    let textView = new Gtk.TextView();
                    textView.set_editable(false);
                    textView.set_cursor_visible(false);
                    hbox.add(textView);
                }
                vbox.add(hbox);
            }
            playerWindow.add(vbox);
        }

        //loop and update component
        let vbox = playerWindow.get_children()[0];
        for (var hboxNo in vbox.get_children()) {
            for (var textViewNo in vbox.get_children()[hboxNo].get_children()) {
                updateStatTextView(vbox.get_children()[hboxNo].get_children()[textViewNo], hboxNo, textViewNo, playerName);
            }
        }

        playerWindow.show_all();
    }
}

function updateStatTextView(subWidget, hboxNo, textViewNo, playerName) {
    let statName = globalData.windowLayout[hboxNo][textViewNo];

    if (statName == "filter") {         //filter
        widgetSetText(subWidget,globalData.players[playerName].filter.getText());                        
        subWidget.set_tooltip_text(globalData.players[playerName].filter.getTooltip());
    } else if (statName == "bb") {  //stack size in big blinds
        var value = globalData.players[playerName].stackSizeInChips / globalData.bigBlind;
        widgetSetText(subWidget,(isNaN(value) ? "" : " "+Math.round(value)+" BB "));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 200, false));
        subWidget.set_tooltip_text("Stack size in big blinds (from the beginning of last hand).");
    } else if (statName == "hands") {  //totalHands
        var value = globalData.players[playerName].stats.hands;
        widgetSetText(subWidget,(isNaN(value) ? "" : "("+Math.round(value)+")"));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 500, true));
        subWidget.set_tooltip_text("Total number of hands dealt to the player.");
    } else if (statName == "vpip") {  //vpip
        var value = globalData.players[playerName].stats.vpip / globalData.players[playerName].stats.hands * 100;
        widgetSetText(subWidget,(isNaN(value) ? "" : " "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("Voluntarily Put $ In Pot. Percentage of hands the player called or raised preflop.");
    } else if (statName == "pfr") {  //pfr
        var value =  globalData.players[playerName].stats.pfr /  globalData.players[playerName].stats.hands * 100;
        widgetSetText(subWidget,(isNaN(value) ? "" : " "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("Pre Flop Raise. The percentage of the hands a player raises before the flop.");
    } else if (statName == "ats") {  //ats
        var value =  globalData.players[playerName].stats.ats /  globalData.players[playerName].stats.atsOpportunity * 100;
        widgetSetText(subWidget,(isNaN(value) ? "" : " ATS "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("Attempt To Steal the blinds. The percentage of the hands a player raises before the flop, when folded to them in cutoff, button or small blind.");
    } else if (statName == "bbfvs") {  //BB fold vs. steal
        var value =  globalData.players[playerName].stats.bbFoldVsSteal /  globalData.players[playerName].stats.bbFacingSteal * 100;
        widgetSetText(subWidget,(isNaN(value) ? "" : " BBFS "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("BB fold vs. steal. The percentage of the hands the player folds when facing a preflop steal.");
    } else if (statName == "wtsd") {  //WTSD
        var value =  globalData.players[playerName].stats.postflopShowdown / globalData.players[playerName].stats.wentToFlop * 100;
        widgetSetText(subWidget,(isNaN(value) ? "" : " WTSD "+Math.round(value)));
        subWidget.override_color(Gtk.StateFlags.NORMAL, getStatColor(value, 100, true));
        subWidget.set_tooltip_text("The percentage of the hands that went to show down, out of the ones that saw the flop.");
    }
}

function widgetSetText(widget,text) {
    let textBuffer = new Gtk.TextBuffer();
    textBuffer.set_text(text, text.length);
    widget.set_buffer(textBuffer);
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
        new windowPosition(parseInt(globalData.maxPlayers), window.get_title().substr(0,1), window.get_position()[0], window.get_position()[1], window.get_size()[0], window.get_size()[1], parseInt(window.get_gravity()) )
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
            if (globalData.windowPositions[windowPositionId].width !== undefined && globalData.windowPositions[windowPositionId].height !== undefined) {
                window.resize(  globalData.windowPositions[windowPositionId].width  , globalData.windowPositions[windowPositionId].height   );
            }
            return;
        }
    }
}

function saveData() {
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
    let file = Gio.file_new_for_path(hudPath+"/data");
	if (file.query_exists(null)) {
        let fileContent = file.read(null).read_bytes(1000000,null).get_data()+ "";
        globalData.windowPositions = JSON.parse(fileContent);
    }
}

function addHand(player, handNumber, realMoney) {
    if (globalData.players[player].hands === undefined) {
        globalData.players[player].hands = [];
    }
    if (globalData.players[player].hands[parseInt(handNumber)] === undefined) {
        globalData.players[player].hands[parseInt(handNumber)] = new Stats(1, realMoney);
    }
}

function refreshPlayerData(playerName) {
    globalData.players[playerName].stats    =   new Stats(0,null);
    
    //Update filters to make sure latest hands are included. Usually required when a player gets eliminated. It's also possible we first played "play money" 6-max and then moved into "real money" 9-max. 
    let playersOnTableNow = globalData.playersByHand[globalData.latestHandNumber].length;
    if (globalData.players[playerName].filter.playersOnTableMin > playersOnTableNow) {
        globalData.players[playerName].filter.playersOnTableMin = playersOnTableNow;
    }
    if (globalData.players[playerName].filter.playersOnTableMax < playersOnTableNow) {
        globalData.players[playerName].filter.playersOnTableMax = playersOnTableNow;
    }
    if (globalData.players[playerName].filter.realMoney !== null) {
        globalData.players[playerName].filter.realMoney = globalData.realMoneyLatestHand;
    }
    
    //sum the stats
    for (var handNumber in globalData.players[playerName].hands) {
        let playersOnHand = globalData.playersByHand[handNumber].length;
        if (    //passes filters
                (globalData.players[playerName].filter.realMoney === null || globalData.players[playerName].filter.realMoney === globalData.players[playerName].hands[parseInt(handNumber)].realMoney)
            &&  (playersOnHand >= globalData.players[playerName].filter.playersOnTableMin)
            &&  (playersOnHand <= globalData.players[playerName].filter.playersOnTableMax)
        ) {
                    
            //sum each property from each hand into the player's sums
            for (var stat in globalData.players[playerName].hands[parseInt(handNumber)]) {
                globalData.players[playerName].stats[stat] += globalData.players[playerName].hands[parseInt(handNumber)][stat];
            }
        }
    }
    
    if (globalData.players[playerName].stats.hands > 500) {
        //many hands, let's filter to get the most relevant hands
        if (globalData.players[playerName].filter.realMoney === null) {
            //filter by real/play money
            globalData.players[playerName].filter.realMoney =   globalData.realMoneyLatestHand;
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

