package mouseRemote

import akka.actor._
import scala.concurrent.duration._

import play.api._
import play.api.libs.json._
import play.api.libs.iteratee._
import play.api.libs.concurrent._

import akka.util.Timeout
import akka.pattern.ask

import play.api.Play.current
import play.api.libs.concurrent.Execution.Implicits._



case class Join()
case class Quit()

case class MouseChanged(x: Int, y: Int)
case class MouseSet(x: Int, y: Int)
case class MouseMove(x: Int, y: Int)

case class MousePress(button: Int)
case class MouseRelease(button: Int)
case class MouseClick(button: Int)

case class KeyPress(keyCode: Int)
case class KeyRelease(keyCode: Int)

case class NotifyJoin()

case class TextChanges(backspaces: Int, deletions: Int, insertions: String);

case class Connected(enumerator:Enumerator[JsValue])
case class CannotConnect(msg: String)

case class MouseRefresh()



// Object which provides a default Remote
object Remote {

  implicit val timeout = Timeout(1 second)

  lazy val default = {
    val remoteActor = Akka.system.actorOf( Props(new Remote(Driver.default)) )

//    Robot(remoteActor)

    remoteActor
  }

  def join():scala.concurrent.Future[(Iteratee[JsValue,_],Enumerator[JsValue])] = {

    (default ? Join()).map {

      case Connected(enumerator) =>

        val iteratee = Iteratee.foreach[JsValue] { event =>
//          Logger.debug(event.toString());

          // Mouse Move
          val mm = event \ "mm";
          mm match {
            case _: JsObject => {
              val x = (event \ "m" \ "x").as[Int]
              val y = (event \ "m" \ "y").as[Int]
              default ! MouseMove(x, y)
            }
            case _: JsArray => {
              val x = (mm(0)).as[Int]
              val y = (mm(1)).as[Int]
              default ! MouseMove(x, y)
            }
            case _ =>
          }


          // Mouse Press
          val mp = event \ "mp";
          mp match {
            case _: JsNumber => {
              default ! MousePress(mp.as[Int])
            }
            case _ =>
          }

          // Mouse Release
          val mr = event \ "mr";
          mr match {
            case _: JsNumber => {
              default ! MouseRelease(mr.as[Int])
            }
            case _ =>
          }

          // Mouse Click
          val mc = event \ "mc";
          mc match {
            case _: JsNumber => {
              default ! MouseClick(mc.as[Int])
            }
            case _ =>
          }

          // Key Press
          val kp = event \ "kp";
          kp match {
            case _: JsNumber => {
              default ! KeyPress(kp.as[Int])
            }
            case _ =>
          }

          // Key Release
          val kr = event \ "kr";
          kr match {
            case _: JsNumber => {
              default ! KeyRelease(kr.as[Int])
            }
            case _ =>
          }

          // Text Changes
          val tc = event \ "tc";
          tc match {
            case _: JsObject => {
              default ! TextChanges(
                (tc \ "b").asOpt[Int].getOrElse(0),
                (tc \ "d").asOpt[Int].getOrElse(0),
                (tc \ "i").asOpt[String].getOrElse("")
              )
            }
            case _ =>
          }



        }.map { _ =>
          default ! Quit()
        }

        (iteratee,enumerator)

      case CannotConnect(error) =>
        // Connection error

        // A finished Iteratee sending EOF
        val iteratee = Done[JsValue,Unit]((),Input.EOF)

        // Send an error and close the socket
        val enumerator =  Enumerator[JsValue](JsObject(Seq("error" -> JsString(error)))).andThen(Enumerator.enumInput(Input.EOF))

        (iteratee,enumerator)

    }

  }

}


// Actor which moves the mouse via the Driver as it receives commands
class Remote(val driver: Driver) extends Actor {

  var members = Set.empty[String]
  val (remoteEnumerator, remoteChannel) = Concurrent.broadcast[JsValue]

  def receive = {

    case Join() => {
      if(false) {
        // Failure
        sender ! CannotConnect("This username is already used")
      } else {
        // Success
        sender ! Connected(remoteEnumerator)
        self ! NotifyJoin()
      }
    }

    case NotifyJoin() => {
      notifyAll("join", "Another user is controlling the mouse")
    }

    case MouseMove(x, y) => {
      driver.mouse.moveCoordinates(x, y)
    }

    case MousePress(button) => {
      driver.mouse.press(button)
    }
    case MouseRelease(button) => {
      driver.mouse.release(button)
    }
    case MouseClick(button) => {
      driver.mouse.click(button)
    }

    case MouseRefresh() => {
      driver.mouse.resetCoordinates
    }


    case KeyPress(keyCode) => {
      driver.keyboard.press(keyCode)
    }
    case KeyRelease(keyCode) => {
      driver.keyboard.release(keyCode)
    }


    case tc: TextChanges => {
      driver.keyboard.backspace(tc.backspaces);
      driver.keyboard.delete(tc.deletions);
      driver.keyboard.insert(tc.insertions);
    }


    case Quit() => {
      notifyAll("quit", "A user has quit controlling the mouse")
    }

  }

  def notifyAll(kind: String, text: String) = {
    val msg = JsObject(
      Seq(
        "kind" -> JsString(kind),
        "message" -> JsString(text),
        "members" -> JsArray(
          members.toList.map(JsString)
        )
      )
    )
    remoteChannel.push(msg)
  }

}




// Bounds defines the boundaries of the mouse
case class Bounds(val left: Int, val top: Int, val right: Int, val bottom: Int){
  def boundedX(x: Int): Int = Math.min(Math.max(x, left), right )
  def boundedY(y: Int): Int = Math.min(Math.max(y, top ), bottom)
  def boundedCoord(x: Int, y: Int) = new Coordinates(boundedX(x), boundedY(y))
}
// Coordinates defines the position of the mouse
case class Coordinates(val left: Int, val top: Int)


// Driver Object / Class
/////////////////////////

// Object which provides a default driver
object Driver {

  import java.awt.event.KeyEvent;

  lazy val default = new Driver()

  def filterKeyCode(keyCode: Int): Int = {
    keyCode match {
      case 13 => KeyEvent.VK_ENTER
      case 10 => KeyEvent.VK_ENTER
      case _ => keyCode
    }
  }
}


// Class which handles moving the mouse around
class Driver {

  // Robot for controlling the mouse
  lazy val smartBot = new SmartRobot()

  object keyboard {
    import java.awt.event.KeyEvent;

    def press(keyCode: Int) = {
      smartBot.keyPress(Driver filterKeyCode keyCode);
    }
    def release(keyCode: Int) = {
      smartBot.keyRelease(Driver filterKeyCode keyCode);
    }

    def click(keyCode: Int) = {
      press(keyCode);
      smartBot.shortDelay
      release(keyCode);
    }

    def clickRepeat(keyCode: Int, times: Int) = {
      (1 to times) foreach { _ =>
        click(keyCode);
        smartBot.shortDelay
      }
    }


    def backspace(times: Int) = clickRepeat(KeyEvent.VK_BACK_SPACE, times)
    def delete(times: Int) = clickRepeat(KeyEvent.VK_DELETE, times)
    def enter(times: Int) = clickRepeat(KeyEvent.VK_ENTER, times)

    def insert(text: String) = {
      smartBot.insertText(text);
    }

  }


  trait CoordinateComponent {

    // Bounds of the coords
    var bounds: Option[Bounds] = None

    // The coordinates of the Mouse
    var coordinates: Option[Coordinates] = None;
    def get = coordinates



    // Sets the coordinates to an absolute value
    def set(c: Option[Coordinates]): Option[Coordinates] = {
      c match {
        case Some(c2) => set(c2)
        case None => coordinates = None; None
      }
    }

    def set(c: Coordinates): Option[Coordinates] = {
      set(c.left, c.top);
    }

    def set(left: Int, top: Int): Option[Coordinates] = {
      import java.awt.{Robot, AWTException}

      val c = bounds match {
        case None => new Coordinates(left, top)
        case Some(b) => b.boundedCoord(left, top)
      }

      try {
        smartBot.mouseMove(c.left, c.top)
        coordinates = Some(c)
        coordinates
      } catch {
        case e: AWTException => None
      }
    }
  }


  object mouse {

    object coordinates extends CoordinateComponent {}

    // Initialize Variables
    resetBounds
    resetCoordinates

    // Coordinates
    ///////////////

    def resetCoordinates: Option[Coordinates] = {
      val c = findCoordinates
      coordinates set c
      c
    }

    def findCoordinates: Option[Coordinates] = {
      import java.awt.MouseInfo
      val pos = MouseInfo.getPointerInfo.getLocation
      return Some(new Coordinates(pos.x, pos.y))
    }


    def moveCoordinates(leftOffset: Int, topOffset: Int): Option[Coordinates] = {
      findCoordinates match {
        case Some(c) => coordinates.set(c.left + leftOffset, c.top + topOffset)
        case _ => None
      }
    }

    // Bounds
    //////////

    def resetBounds: Unit = {
      coordinates.bounds = findBounds
    }

    def findBounds: Option[Bounds] = {
  //    // Method 1
  //    import java.awt.GraphicsEnvironment;
  //    val lge = GraphicsEnvironment.getLocalGraphicsEnvironment();
  //    val mwb = lge.getMaximumWindowBounds
  //    val gd = lge.getDefaultScreenDevice()
  //    val dm = gd.getDisplayMode
  //    return new Bounds(0,0, mwb.getWidth dm.getWidth(), dm.getHeight())

      //Method 2
      val ss = java.awt.Toolkit.getDefaultToolkit().getScreenSize
      return Some(new Bounds(0, 0, ss.getWidth.toInt, ss.getHeight.toInt))
    }



    // Press / Release / Click
    ///////////////////////////

    def buttonToInputEvent(button: Int) = {
      button match {
        case 1 => java.awt.event.InputEvent.BUTTON1_MASK
        case 2 => java.awt.event.InputEvent.BUTTON2_MASK
        case 3 => java.awt.event.InputEvent.BUTTON3_MASK
        case _ => java.awt.event.InputEvent.BUTTON1_MASK
      }
    }

    def press(button: Int = 0): Unit = {
      smartBot.mousePress(buttonToInputEvent(button));
    }
    def release(button: Int = 0): Unit = {
      smartBot.mouseRelease(buttonToInputEvent(button));
    }

    def click(button: Int = 0): Unit = {
      press(button);
      smartBot.shortDelay;
      release(button);
    }

  }


}



class SmartRobot extends java.awt.Robot()
{
  import java.awt.event.KeyEvent;

  def writeToClipboard(s: String) =
  {
    val clipboard = java.awt.Toolkit.getDefaultToolkit().getSystemClipboard();
    val transferable = new java.awt.datatransfer.StringSelection(s);
    clipboard.setContents(transferable, null);
  }

  def pasteClipboard() =
  {
    keyPress(KeyEvent.VK_CONTROL);
    keyPress(KeyEvent.VK_V);
    shortDelay
    keyRelease(KeyEvent.VK_V);
    keyRelease(KeyEvent.VK_CONTROL);
  }

  def insertText(text: String) =
  {
    writeToClipboard(text);
    pasteClipboard();
  }

  def shortDelay = delay(10)

}

