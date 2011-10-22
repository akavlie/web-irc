$(function() {

    // MODELS & COLLECTIONS
    // ====================
    var Message = Backbone.Model.extend({
        defaults: {
            sender: '',
            channel: '',
            text: ''
        }
    });

    var Channel = Backbone.Model.extend({
        initialize: function() {
            console.log('Joining ' + this.name);
            socket.emit('join', {name: this.name});
        },

        defaults: {
            name: ''
        }
    });

    var ChannelList = Backbone.Collection.extend({
        model: Channel
        
    });

    var Stream = Backbone.Collection.extend({
        model: Message
        
    });

    window.channels = new ChannelList;
    window.stream = new Stream;


    // VIEWS
    // =====
    var MessageView = Backbone.View.extend({

    	render: function() {
            var msg = this.model.get('sender') + ': ' + this.model.get('text');
            $(this.el).html(msg);
            return this;
    	}
    });

    var ChannelView = Backbone.View.extend({
        el: $('.channel'),

        initialize: function() {
            // this.render();
            stream.bind('add', this.add, this);
        },

    	add: function(message) {
           var view = new MessageView({model: message});
           $(this.el).append(view.render().el);
    	},

        render: function() {
            $(this.el).html('<div class="channel"/>');
            return this;
        }

    });

    var channel = new ChannelView;

    /*
    var ChannelListView = Backbone.View.extend({
        el: $('.channels li'),
        events: {
            'click': 'join',
            'click .close': 'leave'
        },

        join: function() {
            console.log('Joining ' + name);
            socket.emit('join', {name: this.$('span').text()});
        },

        leave: function() {
            
        }
        
    });
    */

    // var channelList = new ChannelListView;

    var AppView = Backbone.View.extend({
        el: $('#content'),
        testChannels: $('#sidebar .channels'),

        initialize: function() {

        },


        joinChannel: function(name) {
            channels.create({name: name})
        }

    });

    var app = new AppView;

    // TO BE REPLACED by actual Backbone stuff
    $('.channels li').click(function() {
        var name = $(this).text();
        app.joinChannel(name);

        // socket.emit('join', {name: name});
    });

    $('.channels li .close').click(function() {
        var name = $(this).paren().text();
        console.log('Leaving ' + name);
        socket.emit('leave', {name: name})
    });


    var socket = io.connect('http://localhost');

    socket.on('message', function(obj) {
        console.log(obj);
    	stream.add({sender: obj.from, channel: obj.to, text: obj.message});
    });

});