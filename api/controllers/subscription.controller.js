"use strict";

const mongoose = require("mongoose");
const definition = require("../helpers/subscription.definition.js").definition;
const SMCrud = require("@appveen/swagger-mongoose-crud");
const utils = require("@appveen/utils");
const _ = require("lodash");
const schema = new mongoose.Schema(definition);
const logger = global.logger;

var options = {
    logger: logger,
    collectionName: "subscription"
};
utils.counter.setDefaults("subscription", 1000);

schema.pre("validate", function (next) {
    this.recipients.forEach(obj => {
        obj.type = obj.type.toLowerCase();
    });
    this.name = _.trim(this.name);
    _.isEmpty(this.name) ? next(new Error("Name is empty")) : null;
    next();
});

schema.pre("save", function (next) {
    this.recipients.forEach(recipient => {
        (!recipient.id || !recipient.type) ? next(new Error("id or type missing in recipients")): null;
    });
    this.recipients = _.uniqBy(this.recipients, (obj) => {
        return obj.id + "_" + obj.type;
    });
    mongoose.model("event").findOne({
        "_id": this.eventID
    }, (err, doc) => {
        if (err) next(new Error("Error querying DB!"));
        else {
            (doc !== null) ? next(): next(new Error("EventID does not exist"));
        }
    });
});

schema.pre("save", utils.counter.getIdGenerator("SUB", "subscription"));
var map = (req) =>
    Object.keys(req.swagger.params).reduce((prev, curr) => {
        prev[curr] = req.swagger.params[curr].value;
        return prev;
    }, {});

function removeRecipients(req, res) {
    updateRecipients(req, res, "remove");
}

function updateRecipients(req, res, action) {
    var reqParam = map(req);
    crudder.model.findOne({
        _id: reqParam["id"],
        deleted: false
    }, function (err, _d) {
        if (err) return SendError(res, err);
        if (action === "modify") {
            _d["recipients"] = req.body["recipients"].forEach(obj => _d["recipients"].push(obj));
        } else if (action === "remove") {
            _.pullAllBy(_d.recipients, req.body["recipients"], (obj) => {
                return obj.id + "_" + obj.type;
            });
        }
        var newModel = new crudder.model(_d);
        newModel.markModified("lastUpdated");
        newModel.save((err) => {
            if (err) return SendError(res, err);
            res.status(200).json(_d);
        });
    });
}

function SendError(res, err) {
    if (err.errors) {
        var errors = [];
        Object.keys(err.errors).forEach(el => errors.push(err.errors[el].message));
        res.status(400).json({
            message: errors
        });
    } else {
        res.status(400).json({
            message: [err.message]
        });
    }
}
var crudder = new SMCrud(schema, "subscription", options);
module.exports = {
    create: crudder.create,
    index: crudder.index,
    show: crudder.show,
    destroy: crudder.destroy,
    count: crudder.count,
    updateRecipients: crudder.update,
    removeRecipients: removeRecipients,
};