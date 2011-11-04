$(function() {
    // Our global object
    window.irc = {};

    // socket.io init
    var socket = io.connect('http://localhost');


    // MODELS & COLLECTIONS
    // ====================
    var Message = Backbone.Model.extend({
        // expected properties:
        // - sender
        // - text
    });

    var Stream = Backbone.Collection.extend({
        model: Message
    });

    var Person = Backbone.Model.extend({
    });

    var Participants = Backbone.Collection.extend({
        model: Person
    });

    var Frame = Backbone.Model.extend({
        // expected properties:
        // - name
        defaults: {'type': 'channel'},
        initialize: function() {
            this.stream = new Stream;
            this.participants = new Participants;
        },

        setActive: function() {
            console.log('Setting ' + this.get('name') + ' as the active frame.');
            // More stuff will go here
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
                return frame.get('name') === name;
            });
        }
 
    });

    // hoisted to window for now, for ease of debugging
    window.frames = new FrameList;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({
        tmpl: $('#message-tmpl').html(),
    	render: function() {
            var context = {
                sender: this.model.get('sender'),
                text: this.model.get('text')
            };
            var html = Mustache.to_html(this.tmpl, context);
            $(this.el).html(html);
            return this;
    	}
    });

    var FrameView = Backbone.View.extend({
        el: $('.frame'),
        // to track scroll position
        position: {},

        initialize: function() {
            // frame.bind('add', this.focus, this);
            _.bindAll(this);
        },

    	addMessage: function(message, single) {
            // Expensive -- only do this on single message additions
            if (single) {
                var position = $('.output').scrollTop();
                atBottom = $('.output')[0].scrollHeight - position
                           == $('.output').innerHeight();
                var position = this.$('.output').scrollTop();
            }
            var view = new MessageView({model: message});
            $('.output').append(view.render().el);
            // Scroll to bottom on new message if already at bottom
            if (atBottom) {
                $('.output').scrollTop(position + 100);
            }
    	},

        addNick: function(person) {
            // TODO: Use a template here!
            this.$('.nicks').append('<div>' + person.get('opStatus') + person.get('nick') + '</div>');
        },

        // Switch focus to a different frame
        focus: function(frame) {
            // Save scroll position for current frame
            if (this.focused) {
                this.position[this.focused.get('name')] = this.$('.output').scrollTop();
            }
            this.focused = frame;
            this.$('.output').empty();
            this.$('.nicks').empty();

            var self = this;
            frame.stream.each(function(message) {
                self.addMessage(message, false);
            });
            frame.participants.each(this.addNick);
            if (frame.get('name') == 'status')
                this.$('.nicks').hide();
            else
                this.$('.nicks').show();
            if (frame.get('type') == 'channel')
                this.el.addClass('channel');
            else
                this.el.removeClass('channel');
                

            this.$('.output').scrollTop(this.position[frame.get('name')] || 0);

            // Only the selected frame should send messages
            frames.each(function(frm) {
                frm.stream.unbind('add');
                frm.participants.unbind('add');
            });
            frame.stream.bind('add', this.addMessage, this);
            frame.participants.bind('add', this.addNick, this);
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
            'click .close-frame': 'part'
        },

        part: function() {
            socket.emit('part', this.model.get('name'));
        },

        close: function() {
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
            'keypress #prime-input': 'parseInput',
        },

        addTab: function(frame) {
            var tab = new FrameTabView({model: frame});
            this.frameList.append(tab.el);
            tab.setActive();
        },

        joinChannel: function(name) {
            socket.emit('join', name);
        },

        parseInput: function(e) {
            if (e.keyCode != 13) return;
            var frame = irc.frameWindow.focused,
                input = this.input.val();

            if (input.indexOf('/') === 0) {
                console.log('IRC command detected -- sending to server');
                socket.emit('command', input.substr(1));
            } else {
                socket.emit('say', {
                    target: frame.get('name'),
                    message: input
                });
                frame.stream.add({sender: me.get('nick'), text: input});
            }

            this.input.val('');
        },

        render: function() {
            // Dynamically assign height
            this.el.show();

            $(window).resize(function() {
                sizeContent($('.frame .output'));
                sizeContent($('.frame .nicks'));
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

            sizeContent($('.frame .output'));
            sizeContent($('.frame .nicks'));
        }
        
    });

    var connect = new ConnectView;

    // Set output window to full height, minus other elements
    function sizeContent(sel) {
        var newHeight = $('html').height() - $('header').outerHeight(true) - 
                        $('#prime-input').outerHeight(true) - 
                        (sel.outerHeight(true) - sel.height()) - 10;
                        // (10 = #content padding)
        sel.height(newHeight);
    } 

    // VERY TEMPORARY -- JUST FOR TESTING
    $('#sidebar .frames li').click(function() {
        var name = $(this).text();
        irc.app.joinChannel(name);
    });


    socket.on('message', function(msg) {
        frame = frames.getByName(msg.to);
        if (frame) {
        	frame.stream.add({sender: msg.from, text: msg.text});
        }
    });

    socket.on('motd', function(data) {
        data.motd.split('\n').forEach(function(line) {
            frames.getByName('status').stream.add({sender: '', text: line});
        });
    });

    socket.on('join', function(data) {
        console.log('Join event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == irc.me.get('nick')) {
            frames.add({name: data.channel});
        }
    });

    socket.on('part', function(data) {
        console.log('Part event received for ' + data.channel + ' - ' + data.nick);
        if (data.nick == irc.me.get('nick')) {
            frames.getByName(data.channel).part();
        }
    });

    socket.on('names', function(data) {
        frame = frames.getByName(data.channel);
        console.log(data);
        for (var nick in data.nicks) {
            frame.participants.add({nick: nick, opStatus: data.nicks[nick]});
        }
    });

});