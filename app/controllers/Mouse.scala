package controllers

import play.api._
import play.api.mvc._

import play.api.libs.json._
import play.api.libs.iteratee._

import models._

import akka.actor._
import scala.concurrent.duration._
import java.sql.Driver

object Mouse extends Controller {
  
  def index = Action { implicit request =>
    Ok(views.html.mouse())
  }

  def remote = WebSocket.async[JsValue] { request  =>
    mouseRemote.Remote.join()
  }



  def moveCoords(x: Int, y: Int) = Action {
    val d = mouseRemote.Driver.default;
    val bounds = d.mouse.resetBounds
    val curCoords = d.mouse.resetCoordinates
    val newCoords = d.mouse.moveCoordinates(x, y).get;

    Ok(<div>
      <div>Bounds<br/> {bounds} </div>
      <div>Old Coords<br/> {curCoords} </div>
      <div>New Coords<br/> {newCoords} </div>fasdf
    </div>)
  }

}




