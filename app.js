$(function() {
    // Our global object
    window.irc = window.irc || {};

    // socket.io init
    var socket = io.connect('http://localhost');


    // MODELS & COLLECTIONS
    // ====================
    var Message = Backbone.Model.extend({
        defaults: {
            // expected properties:
            // - sender
            // - text
            'type': 'message'
        },

        // Set output text for status messages
        setText: function() {
            var text = '';
            switch (this.get('type')) {
                case 'join':
                    text = this.get('nick') + ' joined the channel';
                    break;
                case 'part':
                    text = this.get('nick') + ' left the channel';
                    break;
                case 'nick':
                    text = this.get('oldNick') + ' is now known as ' + this.get('newNick');
                    break;
            }
            this.set({text: text});
        }
    });

    var Stream = Backbone.Collection.extend({
        model: Message
    });

    var Person = Backbone.Model.extend({
        defaults: {
            opStatus: ''
        }
    });

    var Participants = Backbone.Collection.extend({
        model: Person,
        getByNick: function(nick) {
            return this.detect(function(person) {
                return person.get('nick') == nick;
            });
        }
    });

    var Frame = Backbone.Model.extend({
        // expected properties:
        // - name
        defaults: {
            'type': 'channel',
            'active': true
        },

        initialize: function() {
            this.stream = new Stream;
            this.participants = new Participants;
        },

        part: function() {
            console.log('Leaving ' + this.get('name'));
            this.destroy();
        }

    });

    var FrameList = Backbone.Collection.extend({
        model: Frame,

        getByName: function(name) {
            return this.detect(function(frame) {
                return frame.get('name') == name;
            });
        },

        getActive: function() {
            return this.detect(function(frame) {
                return frame.get('active') == true;
            });
        },

        setActive: function(frame) {
            this.each(function(frm) {
                frm.set({active: false});
            });

            frame.set({active: true});
        },

        getChannels: function() {
            return this.filter(function(frame) {
                return frame.get('type') == 'channel';
            });
        }
 
    });

    // hoisted to window for now, for ease of debugging
    window.frames = new FrameList;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({
        tmpl: $('#message-tmpl').html(),
        initialize: function() {
            this.render();
        },

    	render: function() {
            var context = {
                sender: this.model.get('sender'),
                text: this.model.get('text')
            };
            var html = Mustache.to_html(this.tmpl, context);
            $(this.el).addClass(this.model.get('type'))
                      .html(html);
            return this;
    	}
    });

    // Nick in the sidebar
    var NickListView = Backbone.View.extend({
        el: $('.nicks'),
        initialize: function() {
            _.bindAll(this);
        },

        // this is a temp. hack
        tmpl: function(opStatus, nick) {
            return '<div>' + opStatus + ' ' + nick + '</div>'
        },

        switchChannel: function(ch) {
            ch.participants.bind('add', this.addOne, this);
            ch.participants.bind('change', this.changeNick, this);
        },

        addOne: function(p) {
            var text = this.tmpl(p.get('opStatus'), p.get('nick'));
            $(this.el).append(text);
        },

        addAll: function(participants) {
            var self = this;
            var nicks = [];
            participants.each(function(p) {
                var text = self.tmpl(p.get('opStatus'), p.get('nick'));
                nicks.push(text);
            });
            $(this.el).html(nicks.join('\n'));
        },

        changeNick: function() {
            console.log('Change of nick seen');
            console.log(arguments);
        }
        
    });
    var nickList = new NickListView;

    var FrameView = Backbone.View.extend({
        el: $('#frame'),
        // to track scroll position
        position: {},

        initialize: function() {
            _.bindAll(this);
        },

    	addMessage: function(message, single) {
            // Expensive -- only do this on single message additions
            if (single) {
                var position = $('#output #messages').scrollTop();
                var atBottom = $('#output #messages')[0].scrollHeight - position
                             == $('#output #messages').innerHeight();
                var position = this.$('#output #messages').scrollTop();
            }
            var view = new MessageView({model: message});
            $('#output #messages').append(view.el);
            // Scroll to bottom on new message if already at bottom
            if (atBottom) {
                $('#output').scrollTop(position + 100);
            }
    	},

        updateTopic: function(channel) {
            this.$('#topic').text(channel.get('topic')).show();
            $('#messages').css('top', $('#topic').outerHeight(true));
        },

        // Switch focus to a different frame
        focus: function(frame) {
            // Save scroll position for frame before switching
            if (this.focused) {
                this.position[this.focused.get('name')] = this.$('#output').scrollTop();
            }
            this.focused = frame;
            frames.setActive(this.focused);
            this.$('#output #messages').empty();

            var self = this;
            frame.stream.each(function(message) {
                self.addMessage(message, false);
            });

            nickList.addAll(frame.participants);

            if (frame.get('type') == 'channel') {
                this.$('#sidebar').show();
                this.$('#topic').show();
                $('.wrapper').css('margin-right', 205);
                $('#messages').css('top', $('#topic').outerHeight(true));
            } else {
                this.$('#sidebar').hide();
                this.$('#topic').hide();
                $('.wrapper').css('margin-right', 0);
                $('#messages').css('top', 0);
            }
            $(this.el).removeClass().addClass(frame.get('type'));

            this.$('#output #messsages').scrollTop(this.position[frame.get('name')] || 0);

            // Only the selected frame should send messages
            frames.each(function(frm) {
                frm.stream.unbind('add');
                frm.participants.unbind();
                frm.unbind();
            });
            frame.bind('change:topic', this.updateTopic, this);
            frame.stream.bind('add', this.addMessage, this);
            nickList.switchChannel(frame);
        },

        updateNicks: function(model, nicks) {
            console.log('Nicks rendered');
        }
    });

    var FrameTabView = Backbone.View.extend({
        tagName: 'li',
        tmpl: $('#tab-tmpl').html(),

        initialize: function() {
            this.model.bind('destroy', this.close, this);
            this.render();
        },

        events: {
            'click': 'setActive',
            'click .close-frame': 'close'
        },

        // Send PART command to server
        part: function() {
            if (this.model.get('type') === 'channel') {
                socket.emit('part', this.model.get('name'));
            } else {
                // PMs don't need an explicit PART
                this.model.destroy();
            }
        },

        // Close frame
        close: function() {
            // Focus on next frame if this one has the focus
            if ($(this.el).hasClass('active')) {
                // Go to previous frame unless it's status
                if ($(this.el).prev().text().trim() !== 'status') {
                    $(this.el).prev().click();
                } else {
                    $(this.el).next().click();
                }
            }
            $(this.el).remove();
        },

        // Set as active tab; focus window on frame
        setActive: function() {
            console.log('View setting active status');
            $(this.el).addClass('active')
                .siblings().removeClass('active');
            irc.frameWindow.focus(this.model);
        },

        render: function() {
            console.log(this.model);
            var self = this;
            var context = {
                text: this.model.get('name'),
                type: this.model.get('type'),
                isStatus: function() {
                    return self.model.get('type') == 'status';
                }
            };
            var html = Mustache.to_html(this.tmpl, context);
            $(this.el).html(html);
            return this;
        }
    });

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testFrames: $('#sidebar .frames'),
        frameList: $('header .frames'),

        initialize: function() {
            frames.bind('add', this.addTab, this);
            this.input = this.$('#prime-input');
            this.render();
        },

        events: {
            'keypress #prime-input': 'sendInput',
        },

        addTab: function(frame) {
            var tab = new FrameTabView({model: frame});
            this.frameList.append(tab.el);
            tab.setActive();
        },

        joinChannel: function(name) {
            socket.emit('join', name);
        },

        // Map common IRC commands to standard (RFC 1459)
        parse: function(text) {
            var command = text.split(' ')[0];
            console.log(command);
            var revised = '';
            switch (command) {
                case 'msg':
                    revised = 'privmsg';
                    break;
                default:
                    revised = command;
                    break;
            }
            return irc.utils.swapCommand(command, revised, text);
        },

        sendInput: function(e) {
            if (e.keyCode != 13) return;
            var frame = irc.frameWindow.focused,
                input = this.input.val();

            if (input.indexOf('/') === 0) {
                console.log('IRC command detected -- sending to server');
                var parsed = this.parse(input.substr(1))
                socket.emit('command', parsed);
                // special case -- no output emitted, yet we want a new frame
                var msgParts = parsed.split(' ');
                if (msgParts[0].toLowerCase() === 'privmsg') {
                    pm = frames.getByName(msgParts[1]) || new Frame({type: 'pm', name: msg.nick});
                    pm.stream.add({sender: msg.nick, text: msg.text})
                    frames.add(pm);
                }
            } else {
                socket.emit('say', {
                    target: frame.get('name'),
                    message: input
                });
                frame.stream.add({sender: irc.me.get('nick'), text: input});
            }

            this.input.val('');
        },

        render: function() {
            // Dynamically assign height
            this.el.show();

            $(window).resize(function() {
                sizeContent($('#frame #output'));
                sizeContent($('#frame #sidebar'));
                sizeContent($('#sidebar .nicks', '.stats'));
            });
        }

    });

    var ConnectView = Backbone.View.extend({
        el: $('#connect'),
        events: {
            'click .btn': 'connect',
            'keypress': 'connectOnEnter'
        },

        initialize: function() {
            _.bindAll(this);
            this.render();
        },
        
        render: function() {
            this.el.modal({backdrop: true, show: true});
            $('#connect-nick').focus();
        },

        connectOnEnter: function(e) {
            if (e.keyCode != 13) return;
            this.connect();
        },

        connect: function(e) {
            e && e.preventDefault();
            
            var connectInfo = {
                nick: $('#connect-nick').val(),
                server: $('#connect-server').val(),
                channels: $('#connect-channels').val().split(' ')
            };

            socket.emit('connect', connectInfo);
            $('#connect').modal('hide');

            irc.me = new Person({nick: connectInfo.nick});

            irc.frameWindow = new FrameView;
            irc.app = new AppView;
            // Create the status "frame"
            frames.add({name: 'status', type: 'status'});

            sizeContent($('#frame #output'));
            sizeContent($('#frame #sidebar'));
            sizeContent($('#sidebar .nicks', '.stats'));
        }
        
    });

    var connect = new ConnectView;

    // UTILS
    // =====
    function humanizeError(message) {
        var text = '';
        switch (message.command) {
            case 'err_unknowncommand':
                text = 'That is not a known IRC command.';
                break;
        }
        return text;
    }

    // Set output window to full height, minus other elements
    function sizeContent(sel, additional) {
        var newHeight = $('html').height() - $('header').outerHeight(true)
                        - $('#prime-input').outerHeight(true)
                        - (sel.outerHeight(true) - sel.height()) - 10;
                        // 10 = #content padding
        if (additional) {
            newHeight -= $(additional).outerHeight(true);
        }
        sel.height(newHeight);
    } 


    // SOCKET EVENTS
    // =============
    socket.on('message', function(msg) {
        // Filter out messages not aimed at a channel or status (i.e. PMs)
        if (msg.to.indexOf('#') !== 0 &&
            msg.to.indexOf('&') !== 0 &&
            msg.to !== 'status') return;
        frame = frames.getByName(msg.to);
        if (frame) {
        	frame.stream.add({sender: msg.from, text: msg.text});
        }
    });

    socket.on('pm', function(msg) {
        pm = frames.getByName(msg.nick) || new Frame({type: 'pm', name: msg.nick});
        pm.stream.add({sender: msg.nick, text: msg.text})
        frames.add(pm);
    })

    // Message of the Day event (on joining a server)
    socket.on('motd', function(data) {
        data.motd.split('\n').forEach(function(line) {
            frames.getByName('status').stream.add({sender: '', text: line});
        });
    });

    // Join channel event
    socket.on('join', function(data) {
        console.log('Join event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == irc.me.get('nick')) {
            frames.add({name: data.channel});
        } else {
            channel = frames.getByName(data.channel);
            channel.participants.add({nick: data.nick});
            var joinMessage = new Message({type: 'join', nick: data.nick});
            joinMessage.setText();
            channel.stream.add(joinMessage);
        }
    });

    // Part channel event
    socket.on('part', function(data) {
        console.log('Part event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == irc.me.get('nick')) {
            frames.getByName(data.channel).part();
        } else {
            channel = frames.getByName(data.channel);
            channel.participants.getByNick(data.nick).destroy();
            var partMessage = new Message({type: 'part', nick: data.nick});
            partMessage.setText();
            channel.stream.add(partMessage);
        }
    });

    // Set topic event
    socket.on('topic', function(data) {
        var channel = frames.getByName(data.channel);
        channel.set({topic: data.topic});
        // TODO: Show this was changed by data.nick in the channel stream
    });

    // Nick change event
    socket.on('nick', function(data) {
        // Update my info, if it's me
        if (data.oldNick == irc.me.get('nick')) {
            irc.me.set({nick: data.newNick});
        }

        // Set new name in all channels
        data.channels.forEach(function(ch) {
            var channel = frames.getByName(ch);
            // Change nick in user list
            channel.participants.getByNick(data.oldNick).set({nick: data.newNick});
            // Send nick change message to channel stream
            var nickMessage = new Message({
                type: 'nick',
                oldNick: data.oldNick,
                newNick: data.newNick
            });
            nickMessage.setText();
            channel.stream.add(nickMessage);
        });
    });

    socket.on('names', function(data) {
        var frame = frames.getByName(data.channel);
        console.log(data);
        for (var nick in data.nicks) {
            frame.participants.add({nick: nick, opStatus: data.nicks[nick]});
        }
    });

    socket.on('error', function(data) {
        console.log(data.message);
        frame = frames.getActive();
        error = humanizeError(data.message);
        frame.stream.add({text: error, type: 'error'})
    });

});